import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerAppImage } from '@reforged/maker-appimage';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const targetArch =
  process.argv.find((arg) => arg.startsWith('--arch='))?.split('=')[1] ??
  process.arch;
const isArm64 = targetArch === 'arm64';

// prettier-ignore
const macSigning = process.env.APPLE_API_KEY_ID
  ? {
      osxSign: {
        optionsForFile: () => ({
          hardenedRuntime: true,
          entitlements: 'build/entitlements.plist',
        }),
      },
      osxNotarize: {
        appleApiKey:    process.env.APPLE_API_KEY_PATH as string,
        appleApiKeyId:  process.env.APPLE_API_KEY_ID   as string,
        appleApiIssuer: process.env.APPLE_API_ISSUER   as string,
      },
    }
  : {
      osxSign: { identity: '-' },
    };

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...macSigning,
  },
  makers: [
    new MakerZIP({}, ['darwin', 'win32']),
    ...(isArm64 ? [] : [new MakerSquirrel({})]),
    new MakerAppImage(),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // prettier-ignore
    new FusesPlugin({
      version: FuseVersion.V1,
      // Flipping fuses rewrites the Electron binary and invalidates its
      // signature; re-apply an ad-hoc signature so it can launch on Apple
      // Silicon (osxSign re-signs with Developer ID afterwards when enabled).
      resetAdHocDarwinSignature: true,
      [FuseV1Options.RunAsNode]:                             false,
      [FuseV1Options.EnableCookieEncryption]:                true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:  false,
      [FuseV1Options.EnableNodeCliInspectArguments]:         false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]:                   true,
    }),
  ],
};

export default config;
