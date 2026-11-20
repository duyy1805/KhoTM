const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const CERTIFICATE_FILE = 'sectigo_public_server_authentication_root_r46.pem';
const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">apilayoutkho.z76.vn</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="@raw/sectigo_public_server_authentication_root_r46" />
        </trust-anchors>
    </domain-config>

    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

function withNetworkSecurityConfig(config) {
    config = withAndroidManifest(config, (androidConfig) => {
        const application = androidConfig.modResults.manifest.application?.[0]?.$;
        if (!application) {
            throw new Error('Android application manifest entry was not found.');
        }

        application['android:networkSecurityConfig'] = '@xml/network_security_config';
        return androidConfig;
    });

    return withDangerousMod(config, ['android', async (androidConfig) => {
        const resourceRoot = path.join(
            androidConfig.modRequest.platformProjectRoot,
            'app',
            'src',
            'main',
            'res',
        );
        const xmlDirectory = path.join(resourceRoot, 'xml');
        const rawDirectory = path.join(resourceRoot, 'raw');
        const certificateSource = path.join(
            androidConfig.modRequest.projectRoot,
            'assets',
            'certificates',
            CERTIFICATE_FILE,
        );

        fs.mkdirSync(xmlDirectory, { recursive: true });
        fs.mkdirSync(rawDirectory, { recursive: true });
        fs.writeFileSync(
            path.join(xmlDirectory, 'network_security_config.xml'),
            NETWORK_SECURITY_CONFIG,
            'utf8',
        );
        fs.copyFileSync(certificateSource, path.join(rawDirectory, CERTIFICATE_FILE));

        return androidConfig;
    }]);
}

module.exports = withNetworkSecurityConfig;
