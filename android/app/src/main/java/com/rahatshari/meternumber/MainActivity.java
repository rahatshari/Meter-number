package com.rahatshari.meternumber;

import android.app.Dialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
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

                // Register Native In-App APK Downloader & Package Installer Bridge
                webView.addJavascriptInterface(new AndroidApkUpdater(), "AndroidApkUpdater");

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
                        final Dialog oauthDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
                        final WebView popupWebView = new WebView(MainActivity.this);

                        WebSettings popupSettings = popupWebView.getSettings();
                        popupSettings.setJavaScriptEnabled(true);
                        popupSettings.setDomStorageEnabled(true);
                        popupSettings.setDatabaseEnabled(true);
                        popupSettings.setSupportMultipleWindows(true);
                        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                        String popupUa = popupSettings.getUserAgentString();
                        if (popupUa != null) {
                            popupSettings.setUserAgentString(popupUa.replace("; wv", "").replace("Version/4.0 ", ""));
                        }

                        CookieManager cm = CookieManager.getInstance();
                        cm.setAcceptCookie(true);
                        cm.setAcceptThirdPartyCookies(popupWebView, true);

                        popupWebView.setWebViewClient(new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                                return false;
                            }
                        });

                        popupWebView.setWebChromeClient(new WebChromeClient() {
                            @Override
                            public void onCloseWindow(WebView window) {
                                try {
                                    oauthDialog.dismiss();
                                } catch (Exception ignored) {}
                            }
                        });

                        oauthDialog.setContentView(popupWebView, new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        ));
                        oauthDialog.setOnDismissListener(d -> {
                            try {
                                popupWebView.destroy();
                            } catch (Exception ignored) {}
                        });
                        oauthDialog.show();

                        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                        transport.setWebView(popupWebView);
                        resultMsg.sendToTarget();
                        return true;
                    }
                });
            }
        } catch (Exception ignored) {}
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

    public class AndroidApkUpdater {
        @JavascriptInterface
        public boolean isNativeApk() {
            return true;
        }

        @JavascriptInterface
        public void downloadAndInstall(String apkUrl) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) return;
            startNativeApkDownloadAndInstall(apkUrl.trim());
        }
    }
}
