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
}

declare global {
  interface Window {
    AndroidApkUpdater?: {
      isNativeApk?: () => boolean;
      downloadAndInstall?: (apkUrl: string) => void;
      pickGoogleAccount?: () => void;
      saveBackupToGoogleDrive?: (jsonContent: string, fileName: string) => void;
    };
    AndroidNativeAuth?: {
      isNativeApk?: () => boolean;
      pickGoogleAccount?: () => void;
      saveBackupToGoogleDrive?: (jsonContent: string, fileName: string) => void;
    };
    __onApkDownloadProgress?: (
      percent: number,
      status: 'downloading' | 'installing' | 'done' | 'error',
      errorMsg?: string
    ) => void;
    __onNativeGoogleAccountPicked?: (email: string) => void;
    __onNativeGoogleAccountCancelled?: () => void;
    __onNativeGoogleAccountError?: (errorMsg: string) => void;
  }
}

const envMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

export const APP_VERSION: string = envMeta.VITE_APP_VERSION || '2.0.1';
export const APP_VERSION_CODE: number = Number(envMeta.VITE_APP_VERSION_CODE || 101);
export const GITHUB_REPO: string = envMeta.VITE_GITHUB_REPO || 'rahatshari/Meter-number';

export const DEFAULT_APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Biddut-Bill-latest.apk`;
export const DEFAULT_RELEASE_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

const AUTO_UPDATE_STORAGE_KEY = 'biddut_bill_auto_update_enabled';

/**
 * Checks whether automatic update checking & prompting is enabled.
 * Defaults to true so users get updates automatically unless they turn it off.
 */
export function isAutoUpdateEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const val = localStorage.getItem(AUTO_UPDATE_STORAGE_KEY);
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Enables or disables automatic updates.
 */
export function setAutoUpdateEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage write error
  }
}

/**
 * Returns true if running inside the installed Android APK with native updater support.
 */
export function isNativeAndroidApk(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.AndroidApkUpdater) &&
    typeof window.AndroidApkUpdater?.downloadAndInstall === 'function'
  );
}

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
 * Cleans raw release notes markdown/text into a single clean list of change strings,
 * stripping out headers, signature lines, SHA1 hashes, and boilerplate instructions.
 */
export function cleanChangelogItems(notesText: string): string[] {
  if (!notesText) return [];
  const rawLines = notesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const cleaned: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith('#') || line.startsWith('---')) continue;
    // Strip markdown bold and leading bullet symbols
    const text = line
      .replace(/^[•\-\*]\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim();

    if (!text) continue;

    // Skip boilerplate headers, signature lines, or download instructions
    const lower = text.toLowerCase();
    if (
      lower.includes('same signature') ||
      lower.includes('sha1:') ||
      text.includes('সিগনেচার') ||
      text.includes('অটোমেটিক ভার্সন') ||
      text.includes('ডাউনলোড ও আপডেট') ||
      text.includes('ক্লিক করে ডাউনলোড') ||
      (text.includes('রিলিজ নোট') && text.endsWith(':')) ||
      (text.includes('পরিবর্তনসমূহ') && text.endsWith(':'))
    ) {
      continue;
    }

    cleaned.push(text);
  }

  return cleaned;
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
    releaseNotes:
      '• সরাসরি Gmail দিয়ে লগইন ও ক্লাউড অটো-সিঙ্ক\n• অ্যাপের ভেতর সরাসরি অটো-আপডেট সুবিধা\n• অফলাইন ও অনলাইন ব্যাকআপ উন্নয়ন',
    publishedAt: new Date().toISOString(),
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
          data.body || `• সংস্করণ v${latestVersion} পারফরম্যান্স ও বাগ ফিক্স আপডেট`;
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
          releaseNotes: meta.notes || `• সংস্করণ v${latestVersion} রিলিজ হয়েছে।`,
          publishedAt: meta.publishedAt || new Date().toISOString(),
        };
      }
    }
  } catch {
    // ignore fetch error
  }

  return fallbackResult;
}

/**
 * Triggers direct download and installation of the APK:
 * - Inside the installed Android APK: uses the native AndroidApkUpdater JavascriptInterface
 *   to download the APK with live progress into cache and launch the Android Package Installer.
 * - In mobile/desktop web browser: initiates direct APK file download.
 */
export function triggerApkUpdateDownload(
  apkUrl: string,
  onProgress?: (
    percent: number,
    status: 'downloading' | 'installing' | 'done' | 'error',
    errorMsg?: string
  ) => void
): void {
  const targetUrl = apkUrl || DEFAULT_APK_DOWNLOAD_URL;

  // 1. Native Android APK In-App Downloader + Package Installer
  if (isNativeAndroidApk() && window.AndroidApkUpdater?.downloadAndInstall) {
    if (onProgress) {
      window.__onApkDownloadProgress = (pct, status, err) => {
        onProgress(pct, status, err);
      };
    }
    window.AndroidApkUpdater.downloadAndInstall(targetUrl);
    return;
  }

  // 2. Browser Download (Mobile Chrome / Desktop Browser)
  if (onProgress) {
    onProgress(35, 'downloading');
    setTimeout(() => onProgress(80, 'downloading'), 350);
    setTimeout(() => onProgress(100, 'done'), 800);
  }

  const link = document.createElement('a');
  link.href = targetUrl;
  link.setAttribute('download', 'Biddut-Bill-update.apk');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
