import fs from 'node:fs';
import path from 'node:path';

/**
 * Configures the Capacitor Android project before building the APK:
 * 1. Auto-increments versionCode and versionName in android/app/build.gradle
 * 2. Configures deterministic Same-Signature release signing using android-keystore/biddut-bill-release.p12
 * 3. Replaces all default Capacitor launcher icons (mipmap-*) with the real বিদ্যুৎ বিল logo (public/icon.png)
 * 4. Adds Android permissions for offline/online network state detection and in-app APK update installation
 */

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const appDir = path.join(androidDir, 'app');
const buildGradlePath = path.join(appDir, 'build.gradle');
const manifestPath = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
const resDir = path.join(appDir, 'src', 'main', 'res');

const versionCode = parseInt(process.env.APP_VERSION_CODE || '101', 10);
const versionName = process.env.APP_VERSION || `2.0.${versionCode - 100}`;
const keystoreSrc = path.join(rootDir, 'android-keystore', 'biddut-bill-release.p12');
const keystoreDest = path.join(appDir, 'biddut-bill-release.p12');

console.log(`🔧 Setting up Android APK project: v${versionName} (versionCode: ${versionCode})`);

if (!fs.existsSync(androidDir)) {
  console.error('❌ android/ directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 1. Copy persistent PKCS12 keystore into android/app/
if (fs.existsSync(keystoreSrc)) {
  fs.copyFileSync(keystoreSrc, keystoreDest);
  console.log('✅ Copied permanent release keystore (same signature guaranteed).');
} else {
  console.warn('⚠️ Keystore not found at', keystoreSrc);
}

// 2. Patch android/app/build.gradle for auto-versioning and Same-Signature signingConfig
if (fs.existsSync(buildGradlePath)) {
  let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');

  // Update versionCode and versionName
  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradleContent = gradleContent.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

  // Inject signingConfigs and wire into buildTypes
  if (!gradleContent.includes('biddut-bill-release.p12')) {
    const signingBlock = `
    signingConfigs {
        release {
            storeFile file("biddut-bill-release.p12")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: "biddutbill2026"
            keyAlias System.getenv("KEY_ALIAS") ?: "biddutbill"
            keyPassword System.getenv("KEY_PASSWORD") ?: "biddutbill2026"
            storeType "PKCS12"
            v1SigningEnabled true
            v2SigningEnabled true
        }
    }`;

    // Place signingConfigs right before buildTypes
    gradleContent = gradleContent.replace(
      /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?\}\s*\}/,
      `${signingBlock}
    buildTypes {
        debug {
            signingConfig signingConfigs.release
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }`
    );
  }

  fs.writeFileSync(buildGradlePath, gradleContent, 'utf8');
  console.log(`✅ Updated build.gradle with versionName="${versionName}", versionCode=${versionCode} & same-signature signingConfig.`);
}

// 3. Replace all mipmap launcher icons so the APK logo displays properly on all Android launchers
const iconSrc512 = path.join(rootDir, 'public', 'icon.png');
const iconMaskable512 = path.join(rootDir, 'public', 'pwa-maskable-512x512.png');
const icon192 = path.join(rootDir, 'public', 'pwa-192x192.png');

const mipmapFolders = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

const sourceIcon = fs.existsSync(iconSrc512) ? iconSrc512 : icon192;
const foregroundIcon = fs.existsSync(iconMaskable512) ? iconMaskable512 : sourceIcon;

if (fs.existsSync(sourceIcon) && fs.existsSync(resDir)) {
  for (const folder of mipmapFolders) {
    const dirPath = path.join(resDir, folder);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.copyFileSync(sourceIcon, path.join(dirPath, 'ic_launcher.png'));
    fs.copyFileSync(sourceIcon, path.join(dirPath, 'ic_launcher_round.png'));
    fs.copyFileSync(foregroundIcon, path.join(dirPath, 'ic_launcher_foreground.png'));
  }

  // Update adaptive icon background color to clean white (#FFFFFF) matching the logo
  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  const bgXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, bgXmlContent, 'utf8');

  // Remove default vector drawable background if present so color background is used cleanly
  const drawableBgXml = path.join(resDir, 'drawable', 'ic_launcher_background.xml');
  const drawableV24BgXml = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(drawableBgXml)) fs.rmSync(drawableBgXml, { force: true });
  if (fs.existsSync(drawableV24BgXml)) fs.rmSync(drawableV24BgXml, { force: true });

  console.log('✅ Configured APK launcher icons (ic_launcher, ic_launcher_round, ic_launcher_foreground) across all mipmap densities.');
}

// 4. Update Android Splash Screens with the official বিদ্যুৎ বিল logo
const splashTargets = [
  { file: 'drawable/splash.png', w: 480, h: 320, icon: 140 },
  { file: 'drawable-port-mdpi/splash.png', w: 320, h: 480, icon: 160 },
  { file: 'drawable-port-hdpi/splash.png', w: 480, h: 800, icon: 240 },
  { file: 'drawable-port-xhdpi/splash.png', w: 720, h: 1280, icon: 360 },
  { file: 'drawable-port-xxhdpi/splash.png', w: 960, h: 1600, icon: 480 },
  { file: 'drawable-port-xxxhdpi/splash.png', w: 1280, h: 1920, icon: 600 },
  { file: 'drawable-land-mdpi/splash.png', w: 480, h: 320, icon: 140 },
  { file: 'drawable-land-hdpi/splash.png', w: 800, h: 480, icon: 180 },
  { file: 'drawable-land-xhdpi/splash.png', w: 1280, h: 720, icon: 260 },
  { file: 'drawable-land-xxhdpi/splash.png', w: 1600, h: 960, icon: 360 },
  { file: 'drawable-land-xxxhdpi/splash.png', w: 1920, h: 1280, icon: 480 },
];

try {
  import('node:child_process').then(({ execFileSync }) => {
    for (const t of splashTargets) {
      const dest = path.join(resDir, t.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        execFileSync('convert', [
          '-size', `${t.w}x${t.h}`,
          'xc:#FFFFFF',
          '(', sourceIcon, '-resize', `${t.icon}x${t.icon}`, ')',
          '-gravity', 'center',
          '-composite',
          dest,
        ]);
      } catch (err) {
        // Fallback: copy sourceIcon directly if convert isn't available
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(sourceIcon, dest);
        }
      }
    }
    console.log('✅ Configured Android splash screen drawables with official app logo.');
  });
} catch (e) {
  console.warn('Splash screen generation note:', e);
}

// 4. Ensure AndroidManifest.xml has required permissions and Bengali label
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // Ensure application uses cleartext/https and proper label
  const requiredPermissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
  ];

  for (const perm of requiredPermissions) {
    const permName = perm.match(/android:name="([^"]+)"/)?.[1];
    if (permName && !manifest.includes(permName)) {
      manifest = manifest.replace('</manifest>', `    ${perm}\n</manifest>`);
    }
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✅ Updated AndroidManifest.xml with network and in-app APK update permissions.');
}
