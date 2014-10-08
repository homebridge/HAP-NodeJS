import os, shutil, subprocess, Scripting, Options

out  = 'build'
name = 'dns_sd_bindings'

def set_options(opt):
  opt.tool_options('compiler_cxx')
  opt.tool_options('node_addon')

def configure(conf):
  conf.check_tool('compiler_cxx')
  conf.check_tool('node_addon')

  # HACK: The current node master builds a i386 binary while older releases used
  # the compilers default x86_64. node-waf still targets x86_64 resulting in an
  # incompatible binary. Building the add-on as a universal binary for both
  # architectures solves this for now ...
  if conf.env.DEST_OS == 'darwin':
    universal_flags = ['-arch', 'i386', '-arch', 'x86_64']
    conf.env.append_value('CXXFLAGS', universal_flags)
    conf.env.append_value('LINKFLAGS_MACBUNDLE', universal_flags)

  includes = ['/usr/local/include'] # help freebsd
  libpath = ['/usr/local/lib']      # help freebsd
  if conf.check( header_name='dns_sd.h'
               , includes=includes
               , uselib_store='DNS_SD'
               , mandatory=True):
    conf.check(lib='dns_sd', libpath=libpath, uselib_store='DNS_SD')
 
    conf.check(function_name='DNSServiceGetAddrInfo',
               header_name="dns_sd.h",
               uselib='DNS_SD')


def build(bld):
  obj = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  obj.target = name
  obj.uselib = 'DNS_SD'
  if bld.env.HAVE_DNSSERVICEGETADDRINFO:
    obj.defines = ['HAVE_DNSSERVICEGETADDRINFO']
  obj.includes = ['..']
  obj.cxxflags = ['-Wall']
  obj.source = [ 'src/dns_sd.cpp'
               , 'src/dns_service_browse.cpp'
               , 'src/dns_service_enumerate_domains.cpp'
               , 'src/dns_service_process_result.cpp'
               , 'src/dns_service_ref.cpp'
               , 'src/dns_service_ref_deallocate.cpp'
               , 'src/dns_service_ref_sock_fd.cpp'
               , 'src/dns_service_register.cpp'
               , 'src/dns_service_resolve.cpp'
               , 'src/dns_service_get_addr_info.cpp'
               , 'src/mdns_utils.cpp'
               , 'src/network_interface.cpp'
               , 'src/txt_record_ref.cpp'
               , 'src/txt_record_create.cpp'
               , 'src/txt_record_deallocate.cpp'
               , 'src/txt_record_set_value.cpp'
               , 'src/txt_record_get_length.cpp'
               , 'src/txt_record_buffer_to_object.cpp'
               ]

  obj = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  obj.target = 'demangle'
  obj.cxxflags = ['-Wall']
  obj.source = [ 'src/demangle.cpp' ]

  #bld.add_post_fun(post_build)


def update_addon_symlink(ctx, directory, target):
  symlink_path = os.path.join(directory, target)
  remove_symlink(symlink_path)
  path_to_addon = os.path.join('..', 'out', ctx.path.bld_dir(ctx.env), target)
  os.symlink(path_to_addon, symlink_path)

def post_build(ctx):
  update_addon_symlink(ctx, 'lib', name + '.node')
  update_addon_symlink(ctx, 'utils/lib', 'demangle.node')


def remove_symlink(symlink):
  if os.path.lexists(symlink):
    os.unlink(symlink)

def distclean(ctx):
  Scripting.distclean(ctx)

  remove_symlink(os.path.join('lib', name + '.node'))
  remove_symlink(os.path.join('utils/lib', 'demangle.node'))

  if os.path.exists('node_modules'):
      shutil.rmtree('node_modules')

def test(ctx):
  subprocess.call(['utils/testrun'])


# vim: set filetype=python shiftwidth=2 softtabstop=2 :
