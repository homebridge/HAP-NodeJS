#ifndef NODE_MDNS_NETWORK_INTERFACE_INCLUDED
#define NODE_MDNS_NETWORK_INTERFACE_INCLUDED

#include "mdns.hpp"

#include <v8.h>

#include "mdns_utils.hpp"

#ifdef NODE_MDNS_HAVE_INTERFACE_NAME_CONVERSION

# ifdef WIN32
#  include <netioapi.h>
# else
#  include <sys/types.h>
#  include <sys/socket.h>
#  include <net/if.h> // if_nametoindex()
# endif

using namespace v8;

namespace node_mdns {

Handle<Value>
if_nametoindex(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 1)) {
        return throwArgumentCountMismatchException(args, 1);
    }
    if ( ! args[0]->IsString()) {
        return throwTypeError("argument 1 must be a string (interface name)");
    }
    String::Utf8Value interfaceName(args[0]->ToString());

#ifdef WIN32
    DWORD aliasLength = MultiByteToWideChar(CP_UTF8, 0, *interfaceName, -1,
            NULL, 0);
    if (aliasLength == 0) {
        return throwError("failed to determine buffer size");
    }

    wchar_t * alias = new wchar_t[aliasLength];
    if ( ! alias) {
        return throwError("failed to allocate alias buffer");
    }

    if (MultiByteToWideChar(CP_UTF8, 0, *interfaceName, -1, alias,
                aliasLength) == 0)
    {
        return throwError("failed to convert utf8 to unicode");
    }

    NET_LUID luid;
    if (ConvertInterfaceAliasToLuid(alias, &luid) != NO_ERROR) {
        delete [] alias;
        return throwError("failed to convert interface alias to luid");
    }

    delete [] alias;

    NET_IFINDEX index = 0;
    if (ConvertInterfaceLuidToIndex(&luid, &index) != NO_ERROR) {
        return throwError("failed to convert interface luid to index");
    }
#else
    unsigned int index = ::if_nametoindex(*interfaceName);
#endif
    if (index == 0) {
        return throwError((std::string("interface '") + *interfaceName +
                    "' does not exist").c_str());
    }
    return scope.Close( Integer::New(index));
}

Handle<Value>
if_indextoname(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 1)) {
        return throwArgumentCountMismatchException(args, 1);
    }
    if ( ! args[0]->IsUint32()) {
        return throwTypeError("argument 1 must be a positive integer "
                "(interface index)");
    }
#ifdef WIN32
    NET_LUID luid;
    if (ConvertInterfaceIndexToLuid(args[0]->Uint32Value(), &luid) != NO_ERROR)
    {
        return throwError("failed to convert interface index to luid");
    }
    enum { size = NDIS_IF_MAX_STRING_SIZE + 1 };
    wchar_t alias[size];
    if (ConvertInterfaceLuidToAlias(&luid, alias, size) != NO_ERROR) {
        return throwError("failed to convert interface luid to alias");
    }
    int utf8Length = WideCharToMultiByte(CP_UTF8, 0, alias, -1,
            NULL, 0, NULL, NULL);
    if (utf8Length == 0) {
        return throwError("failed to determine buffer size");
    }
    char * nameBuffer = new char[utf8Length];

    if (WideCharToMultiByte(CP_UTF8, 0, alias, -1, nameBuffer, utf8Length,
                NULL, NULL) == 0)
    {
        delete [] nameBuffer;
        return throwError("failed to convert unicode to utf8");
    }
    Local<String> name = String::New(nameBuffer);
    delete [] nameBuffer;
#else
    char nameBuffer[IFNAMSIZ];
    if ( ! ::if_indextoname(args[0]->Uint32Value(), nameBuffer)) {
        return throwError("index has no corresponding interface");
    }
    Local<String> name = String::New(nameBuffer);
#endif
    return scope.Close(name);
}

} // end of namespace node_mdns

#endif // NODE_MDNS_HAVE_INTERFACE_NAME_CONVERSION

#endif // NODE_MDNS_NETWORK_INTERFACE_INCLUDED
