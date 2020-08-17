<?php

use craft\helpers\App;

return [
    "*" => [
        "pipeline" => "passthrough",
        "strategies" => [
            "passthrough" => function ($filename, $config) {
                return $filename;
            },
        ],
        "assetsBasePath" => App::env("ASSET_REV_BASE_PATH"),
        "assetUrlPrefix" => App::env("ASSET_REV_URL_PREFIX"),
    ],
    "production" => [
        "pipeline" => "manifest|passthrough",
        "strategies" => [
            "manifest" => \club\assetrev\utilities\strategies\ManifestFileStrategy::class,
            "passthrough" => function ($filename, $config) {
                return $filename;
            }
        ],
        "manifestPath" => App::env("ASSET_REV_MANIFEST_PATH"),
    ]
];
