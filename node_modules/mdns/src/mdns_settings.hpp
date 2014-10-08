#ifndef NODE_MDNS_SETTINGS_INCLUDED
# define NODE_MDNS_SETTINGS_INCLUDED

# ifdef WIN32
#  define _WINSOCKAPI_
#  include <windows.h>

   // Microsoft namespace pollution. A macro called 'max'? Srsly?
#  ifdef max
#   undef max
#  endif

#  ifndef NTDDI_VISTA
#   define NTDDI_VISTA 0x6000000
#  endif

#  if NTDDI_VERSION >= NTDDI_VISTA
#   define NODE_MDNS_HAVE_INTERFACE_NAME_CONVERSION
#  endif

# else // Unices

#  define NODE_MDNS_HAVE_INTERFACE_NAME_CONVERSION

# endif // WIN32


#endif // NODE_MDNS_SETTINGS_INCLUDED
