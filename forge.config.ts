import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

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
    icon: 'build/icon',
    ...macSigning,
  },
  makers: [new MakerDMG({ icon: 'build/icon.icns' }, ['darwin'])],
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
      resetAdHocDarwinSignature: true,
      [FuseV1Options.RunAsNode]:                             false,
      // Why EnableCookieEncryption is false:
      // This app needs to avoid Safe Storage alerts
      [FuseV1Options.EnableCookieEncryption]:                false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:  false,
      [FuseV1Options.EnableNodeCliInspectArguments]:         false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]:                   true,
    }),
  ],
};

export default config;
