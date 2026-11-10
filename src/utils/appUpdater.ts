export interface AppUpdateInfo {
  currentVersion: string;
  currentVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  hasUpdate: boolean;
  apkDownloadUrl: string;
  releasePageUrl: string;
  releaseNotes: string;
  publishedAt: string;
  signatureSha1: string;
}

const envMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

export const APP_VERSION: string = envMeta.VITE_APP_VERSION || '2.0.1';
export const APP_VERSION_CODE: number = Number(envMeta.VITE_APP_VERSION_CODE || 101);
export const GITHUB_REPO: string = envMeta.VITE_GITHUB_REPO || 'rahatshari/Meter-number';
export const APK_SIGNATURE_SHA1 = 'A7:F8:FB:7B:E5:B5:E2:4F:6C:A2:43:CB:F2:E7:6F:D9:C5:0C:AE:62';

export const DEFAULT_APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Biddut-Bill-latest.apk`;
export const DEFAULT_RELEASE_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

/**
 * Parses a semantic version string (e.g. "v2.0.15" or "2.0.15") into numeric parts [2, 0, 15].
 */
export function parseVersionParts(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0];
  const cleaned = String(versionStr).trim().replace(/^[vV]/, '').split('-')[0];
  const parts = cleaned.split('.').map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  while (parts.length < 3) parts.push(0);
  return parts;
}

/**
 * Determines whether remoteVersion / remoteVersionCode is strictly newer than currentVersion / currentVersionCode.
 */
export function isNewerVersion(
  currentVersion: string,
  remoteVersion: string,
  currentCode?: number,
  remoteCode?: number
): boolean {
  if (
    typeof currentCode === 'number' &&
    typeof remoteCode === 'number' &&
    !isNaN(currentCode) &&
    !isNaN(remoteCode) &&
    remoteCode !== currentCode
  ) {
    return remoteCode > currentCode;
  }

  const curr = parseVersionParts(currentVersion);
  const rem = parseVersionParts(remoteVersion);
  const len = Math.max(curr.length, rem.length);

  for (let i = 0; i < len; i++) {
    const c = curr[i] || 0;
    const r = rem[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Checks GitHub Releases API and version.json for a newer APK release.
 */
export async function checkForAppUpdate(
  currentVersion: string = APP_VERSION,
  currentVersionCode: number = APP_VERSION_CODE
): Promise<AppUpdateInfo> {
  const fallbackResult: AppUpdateInfo = {
    currentVersion,
    currentVersionCode,
    latestVersion: currentVersion,
    latestVersionCode: currentVersionCode,
    hasUpdate: false,
    apkDownloadUrl: DEFAULT_APK_DOWNLOAD_URL,
    releasePageUrl: DEFAULT_RELEASE_PAGE_URL,
    releaseNotes: 'অফলাইন ফার্স্ট ও স্বয়ংক্রিয় ক্লাউড সিঙ্ক, একই সিগনেচার APK এবং ইন-অ্যাপ অটো-আপডেট সংস্করণ।',
    publishedAt: new Date().toISOString(),
    signatureSha1: APK_SIGNATURE_SHA1,
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return fallbackResult;
  }

  // 1. Try checking GitHub Releases API (?per_page=1 returns 200 [] even before first release)
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const releases = await res.json();
      const data = Array.isArray(releases) && releases.length > 0 ? releases[0] : null;
      if (data && data.tag_name) {
        const rawTag: string = data.tag_name || '';
        const latestVersion = rawTag.replace(/^[vV]/, '') || currentVersion;
        const parts = parseVersionParts(latestVersion);
        const inferredCode = 100 + (parts[2] || 1);

        const assets: Array<{ name?: string; browser_download_url?: string }> = Array.isArray(
          data.assets
        )
          ? data.assets
          : [];
        const apkAsset =
          assets.find((a) => a.name && a.name.endsWith('.apk') && !a.name.includes('latest')) ||
          assets.find((a) => a.name && a.name.endsWith('.apk'));

        const apkDownloadUrl = apkAsset?.browser_download_url || DEFAULT_APK_DOWNLOAD_URL;
        const releasePageUrl = data.html_url || DEFAULT_RELEASE_PAGE_URL;
        const releaseNotes =
          data.body || `নতুন সংস্করণ v${latestVersion} পাওয়া গেছে। সরাসরি ডাউনলোড ও আপডেট করুন।`;
        const publishedAt = data.published_at || new Date().toISOString();

        const hasUpdate = isNewerVersion(
          currentVersion,
          latestVersion,
          currentVersionCode,
          inferredCode
        );

        return {
          currentVersion,
          currentVersionCode,
          latestVersion,
          latestVersionCode: inferredCode,
          hasUpdate,
          apkDownloadUrl,
          releasePageUrl,
          releaseNotes,
          publishedAt,
          signatureSha1: APK_SIGNATURE_SHA1,
        };
      }
    }
  } catch {
    // Fallback to version.json check below
  }

  // 2. Fallback: Check version.json
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const meta = await res.json();
      if (meta && meta.version) {
        const latestVersion = String(meta.version).replace(/^[vV]/, '');
        const latestVersionCode = Number(meta.versionCode) || currentVersionCode;
        const hasUpdate = isNewerVersion(
          currentVersion,
          latestVersion,
          currentVersionCode,
          latestVersionCode
        );

        return {
          currentVersion,
          currentVersionCode,
          latestVersion,
          latestVersionCode,
          hasUpdate,
          apkDownloadUrl: meta.apkUrl || meta.latestApkUrl || DEFAULT_APK_DOWNLOAD_URL,
          releasePageUrl: meta.releasePageUrl || DEFAULT_RELEASE_PAGE_URL,
          releaseNotes: meta.notes || `নতুন সংস্করণ v${latestVersion} রিলিজ হয়েছে।`,
          publishedAt: meta.publishedAt || new Date().toISOString(),
          signatureSha1: meta.signatureSha1 || APK_SIGNATURE_SHA1,
        };
      }
    }
  } catch {
    // ignore fetch error
  }

  return fallbackResult;
}

/**
 * Triggers direct download and installation of the signed APK inside Android WebView / browser.
 */
export function triggerApkUpdateDownload(apkUrl: string): void {
  const targetUrl = apkUrl || DEFAULT_APK_DOWNLOAD_URL;
  const link = document.createElement('a');
  link.href = targetUrl;
  link.setAttribute('download', 'Biddut-Bill-update.apk');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
