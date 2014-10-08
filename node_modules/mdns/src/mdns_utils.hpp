#ifndef NODE_MDNS_UTILS_INCLUDED
#define NODE_MDNS_UTILS_INCLUDED

#include <sstream>
#include <errno.h>
#include <fcntl.h>

namespace node_mdns {

const char * errorString(DNSServiceErrorType error);
v8::Local<v8::Value> buildException(DNSServiceErrorType error_code);

inline
v8::Handle<v8::Value>
throwError(const char * message) {
    return ThrowException( v8::Exception::Error( v8::String::New( message )));
}

inline
v8::Handle<v8::Value>
throwTypeError(const char * message) {
    return ThrowException( v8::Exception::TypeError( v8::String::New( message )));
}

inline
v8::Handle<v8::Value>
throwMdnsError(DNSServiceErrorType error_code) {
    return ThrowException(buildException(error_code));
}

inline
bool
argumentCountMismatch(v8::Arguments const& args, int expectedCount) {
    return args.Length() != expectedCount;
}

inline
v8::Handle<v8::Value>
throwArgumentCountMismatchException(v8::Arguments const& args, size_t expectedCount) {
    std::ostringstream msg;
    msg << "argument count mismatch: expected " << expectedCount 
        << ", but got " <<  args.Length() << " arguments.";
    return throwError(msg.str().c_str());
}

inline
v8::Local<v8::Value>
stringOrUndefined(const char * str) {
    return v8::Local<v8::Value>::New(str ? v8::String::New(str) : v8::Undefined());
}

} // end of namespace node_mdns

#endif // NODE_MDNS_UTILS_INCLUDED
