{ 'targets': [
    { 'target_name': 'dns_sd_bindings'
    , 'sources': [ 'src/dns_sd.cpp'
                 , 'src/dns_service_browse.cpp'
                 , 'src/dns_service_enumerate_domains.cpp'
                 , 'src/dns_service_get_addr_info.cpp'
                 , 'src/dns_service_process_result.cpp'
                 , 'src/dns_service_ref.cpp'
                 , 'src/dns_service_ref_deallocate.cpp'
                 , 'src/dns_service_ref_sock_fd.cpp'
                 , 'src/dns_service_register.cpp'
                 , 'src/dns_service_resolve.cpp'
                 , 'src/mdns_utils.cpp'
                 , 'src/network_interface.cpp'
                 , 'src/socket_watcher.cpp'
                 , 'src/txt_record_ref.cpp'
                 , 'src/txt_record_create.cpp'
                 , 'src/txt_record_deallocate.cpp'
                 , 'src/txt_record_set_value.cpp'
                 , 'src/txt_record_get_length.cpp'
                 , 'src/txt_record_buffer_to_object.cpp'
                 ]
    , 'conditions': [
        [ 'OS!="mac" and OS!="win"', {
            'libraries': [ '-ldns_sd' ]
        }]
      , [ 'OS=="mac"', {
            'defines': [ 'HAVE_DNSSERVICEGETADDRINFO' ]
        }]
      , ['OS=="win"', {
            'include_dirs': [ '$(BONJOUR_SDK_HOME)Include' ]
          , 'defines': [ 'HAVE_DNSSERVICEGETADDRINFO' ]
          , 'libraries': [ '-l$(BONJOUR_SDK_HOME)Lib/$(Platform)/dnssd.lib'
                         , '-lws2_32.lib'
                         , '-liphlpapi.lib'
                         ]
        }]
      ]
    # The following breaks the debug build, so just ignore the warning for now.
    #, 'msbuild_settings': {
    #    'ClCompile': { 'ExceptionHandling': 'Sync' }
    #  , 'Link'     : { 'IgnoreSpecificDefaultLibraries': [ 'LIBCMT' ] }
    #  }
    , 'configurations': {
        'Release': {
            'xcode_settings': { 'GCC_OPTIMIZATION_LEVEL': 3 }
          , 'cflags': [ '-O3' ]
          , 'ldflags': [ '-O3' ]
        }
      , 'Debug': {
            'xcode_settings': { 'GCC_OPTIMIZATION_LEVEL': 0 }
          , 'cflags': [ '-g', '-O0', ]
          , 'ldflags': [ '-g', '-O0' ]
        }
      , 'Coverage': {
            'xcode_settings': {
                'GCC_OPTIMIZATION_LEVEL': 0
              , 'OTHER_LDFLAGS': ['--coverage']
              , 'OTHER_CFLAGS':  ['--coverage']
            }
          , 'cflags': [ '-O0', '--coverage' ]
          , 'ldflags': [ '--coverage' ]
        }
      }
    }
  ]
}

# vim: filetype=python shiftwidth=2 softtabstop=2 :
