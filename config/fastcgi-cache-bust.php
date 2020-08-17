<?php

return [
    '*' => [],
    'dev' => [
        'cachePath' => null
    ],
    'staging' => [
        'cachePath' => null
    ],
    'production' => [
        'cachePath' => '/var/run/nginx-cache/[[name]]'
    ],
];
