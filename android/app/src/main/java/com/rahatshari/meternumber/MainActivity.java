package com.rahatshari.meternumber;

import android.accounts.AccountManager;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    private static final int RC_PICK_GOOGLE_ACCOUNT = 9001;
    private WebView appWebView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            this.appWebView = webView;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setSupportMultipleWindows(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);

                // Strip "; wv" and "Version/4.0 " so Google OAuth never blocks Android WebView
                String originalUa = settings.getUserAgentString();
                if (originalUa != null) {
                    String cleanUa = originalUa.replace("; wv", "").replace("Version/4.0 ", "");
                    settings.setUserAgentString(cleanUa);
                }

                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                // Register Native In-App APK Downloader, Package Installer & Native Google Account Picker Bridge
                AndroidApkUpdater nativeBridge = new AndroidApkUpdater();
                webView.addJavascriptInterface(nativeBridge, "AndroidApkUpdater");
                webView.addJavascriptInterface(nativeBridge, "AndroidNativeAuth");

                // Also intercept any direct .apk download links inside WebView
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        if (url != null && (url.contains(".apk") || "application/vnd.android.package-archive".equals(mimetype))) {
                            startNativeApkDownloadAndInstall(url);
                        } else if (url != null) {
                            try {
                                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                startActivity(browserIntent);
                            } catch (Exception ignored) {}
                        }
                    }
                });

                webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                        // Never open the isolated WebView OAuth login form on Android;
                        // always launch the phone's Native Android Google Account Picker instead.
                        startNativeGoogleAccountPicker();
                        return false;
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == RC_PICK_GOOGLE_ACCOUNT) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                String email = data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
                if (email != null && !email.trim().isEmpty()) {
                    notifyJsGoogleAccountPicked(email.trim());
                } else {
                    notifyJsGoogleAccountCancelled();
                }
            } else {
                notifyJsGoogleAccountCancelled();
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void startNativeGoogleAccountPicker() {
        runOnUiThread(() -> {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    intent = AccountManager.newChooseAccountIntent(
                        null,
                        null,
                        new String[]{"com.google"},
                        null,
                        null,
                        null,
                        null
                    );
                } else {
                    intent = AccountManager.newChooseAccountIntent(
                        null,
                        null,
                        new String[]{"com.google"},
                        false,
                        null,
                        null,
                        null,
                        null
                    );
                }
                startActivityForResult(intent, RC_PICK_GOOGLE_ACCOUNT);
            } catch (Exception e) {
                notifyJsGoogleAccountError(e.getMessage());
            }
        });
    }

    private void notifyJsGoogleAccountPicked(final String email) {
        if (appWebView == null) return;
        final String safeEmail = email == null ? "" : email.replace("'", "\\'").replace("\n", "").trim();
        appWebView.post(() -> {
            try {
                appWebView.evaluateJavascript(
                    "if(window.__onNativeGoogleAccountPicked){window.__onNativeGoogleAccountPicked('" + safeEmail + "');}",
                    null
                );
            } catch (Exception ignored) {}
        });
    }

    private void notifyJsGoogleAccountCancelled() {
        if (appWebView == null) return;
        appWebView.post(() -> {
            try {
                appWebView.evaluateJavascript(
                    "if(window.__onNativeGoogleAccountCancelled){window.__onNativeGoogleAccountCancelled();}",
                    null
                );
            } catch (Exception ignored) {}
        });
    }

    private void notifyJsGoogleAccountError(final String errorMsg) {
        if (appWebView == null) return;
        final String safeErr = errorMsg == null ? "" : errorMsg.replace("'", "\\'").replace("\n", " ");
        appWebView.post(() -> {
            try {
                appWebView.evaluateJavascript(
                    "if(window.__onNativeGoogleAccountError){window.__onNativeGoogleAccountError('" + safeErr + "');}",
                    null
                );
            } catch (Exception ignored) {}
        });
    }

    private void notifyJsProgress(final int percent, final String status, final String errorMsg) {
        if (appWebView == null) return;
        final String safeErr = errorMsg == null ? "" : errorMsg.replace("'", "\\'").replace("\n", " ");
        appWebView.post(() -> {
            try {
                appWebView.evaluateJavascript(
                    "if(window.__onApkDownloadProgress){window.__onApkDownloadProgress(" + percent + ",'" + status + "','" + safeErr + "');}",
                    null
                );
            } catch (Exception ignored) {}
        });
    }

    private void startNativeApkDownloadAndInstall(final String apkUrl) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            InputStream input = null;
            FileOutputStream output = null;
            try {
                notifyJsProgress(5, "downloading", "");

                String currentUrl = apkUrl;
                int redirects = 0;
                while (redirects < 10) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "BiddutBill-Android-Updater");
                    conn.connect();

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_MOVED_PERM ||
                        code == HttpURLConnection.HTTP_MOVED_TEMP ||
                        code == HttpURLConnection.HTTP_SEE_OTHER ||
                        code == 307 || code == 308) {
                        String location = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (location == null) break;
                        currentUrl = location;
                        redirects++;
                    } else {
                        break;
                    }
                }

                if (conn == null || conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    notifyJsProgress(0, "error", "APK ডাউনলোড সার্ভার সাড়া দেয়নি");
                    return;
                }

                int fileLength = conn.getContentLength();
                File apkFile = new File(getCacheDir(), "Biddut-Bill-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                input = conn.getInputStream();
                output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                long total = 0;
                int count;
                int lastReported = 5;

                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    output.write(buffer, 0, count);
                    if (fileLength > 0) {
                        int pct = (int) ((total * 95) / fileLength) + 5;
                        if (pct > 99) pct = 99;
                        if (pct >= lastReported + 4) {
                            lastReported = pct;
                            notifyJsProgress(pct, "downloading", "");
                        }
                    }
                }
                output.flush();
                output.close();
                output = null;
                input.close();
                input = null;

                notifyJsProgress(100, "installing", "");

                Uri apkUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(installIntent);

                notifyJsProgress(100, "done", "");
            } catch (Exception e) {
                notifyJsProgress(0, "error", e.getMessage());
            } finally {
                try { if (output != null) output.close(); } catch (Exception ignored) {}
                try { if (input != null) input.close(); } catch (Exception ignored) {}
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private void shareJsonToGoogleDrive(final String jsonContent, final String fileName) {
        runOnUiThread(() -> {
            FileOutputStream fos = null;
            try {
                String safeName = (fileName == null || fileName.trim().isEmpty())
                    ? "Biddut_Bill_Backup.json"
                    : fileName.trim();
                File backupFile = new File(getCacheDir(), safeName);
                fos = new FileOutputStream(backupFile);
                fos.write((jsonContent == null ? "{}" : jsonContent).getBytes("UTF-8"));
                fos.flush();
                fos.close();
                fos = null;

                Uri fileUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    backupFile
                );

                // First try opening the official Google Drive app's "Save to Drive" screen directly
                Intent driveIntent = new Intent(Intent.ACTION_SEND);
                driveIntent.setType("application/json");
                driveIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                driveIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
                driveIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                driveIntent.setPackage("com.google.android.apps.docs");

                try {
                    startActivity(driveIntent);
                } catch (Exception notInstalled) {
                    // Fallback to system share sheet so user can pick Drive or any cloud storage app
                    Intent chooserIntent = new Intent(Intent.ACTION_SEND);
                    chooserIntent.setType("application/json");
                    chooserIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                    chooserIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
                    chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(chooserIntent, "Google Drive-এ ব্যাকআপ সেভ করুন"));
                }
            } catch (Exception ignored) {
            } finally {
                try { if (fos != null) fos.close(); } catch (Exception ignored) {}
            }
        });
    }

    public class AndroidApkUpdater {
        @JavascriptInterface
        public boolean isNativeApk() {
            return true;
        }

        @JavascriptInterface
        public void pickGoogleAccount() {
            startNativeGoogleAccountPicker();
        }

        @JavascriptInterface
        public void saveBackupToGoogleDrive(String jsonContent, String fileName) {
            shareJsonToGoogleDrive(jsonContent, fileName);
        }

        @JavascriptInterface
        public void downloadAndInstall(String apkUrl) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) return;
            startNativeApkDownloadAndInstall(apkUrl.trim());
        }
    }
}
