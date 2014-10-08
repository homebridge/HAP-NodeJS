{
  'targets': [
    {
      'target_name': 'bignum',
      'sources': [ 'bignum.cc' ],
      "conditions": [
        ['target_arch=="ia32"', {
          'variables': {'openssl_config_path':
                        '<(nodedir)/deps/openssl/config/piii'},
        }, {
          'variables': {'openssl_config_path':
                        '<(nodedir)/deps/openssl/config/k8'},
        }]
      ],
      "include_dirs": [
        "<(nodedir)/deps/openssl/openssl/include",
        "<(openssl_config_path)"
      ]
    }
  ]
}
