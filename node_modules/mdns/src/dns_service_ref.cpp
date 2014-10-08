#include "mdns.hpp"

#include "dns_service_ref.hpp"
#include "mdns_utils.hpp"

using namespace v8;

namespace node_mdns {

Persistent<FunctionTemplate> ServiceRef::constructor_template;

static Persistent<String> fd_symbol;
static Persistent<String> initialized_symbol;

ServiceRef::ServiceRef() : ref_(), callback_(), context_() {}

ServiceRef::~ServiceRef() {
    // First, dispose the serice ref. This cancels all asynchronous operations.
    if (ref_) {
        DNSServiceRefDeallocate(ref_);
    }
    // Then release the js objects.
    if ( ! callback_.IsEmpty()) {
        callback_.Dispose();
    }
    if ( ! context_.IsEmpty()) {
        context_.Dispose();
    }
}

void
ServiceRef::Initialize(Handle<Object> target) {
    Local<FunctionTemplate> t = FunctionTemplate::New(New);
    constructor_template = Persistent<FunctionTemplate>::New(t);
    constructor_template->InstanceTemplate()->SetInternalFieldCount(1);
    constructor_template->SetClassName(String::NewSymbol("DNSServiceRef"));

    fd_symbol = NODE_PSYMBOL("fd");
    initialized_symbol = NODE_PSYMBOL("initialized");

    constructor_template->InstanceTemplate()->SetAccessor(fd_symbol, fd_getter);
    constructor_template->InstanceTemplate()->SetAccessor(initialized_symbol, initialized_getter);
    target->Set(String::NewSymbol("DNSServiceRef"), constructor_template->GetFunction());
}

Handle<Value>
ServiceRef::New(const Arguments & args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 0)) {
        return throwArgumentCountMismatchException(args, 0);
    }
    ServiceRef * o = new ServiceRef();
    o->Wrap(args.Holder());
    return args.This();
}

bool
ServiceRef::IsInitialized() const { return ref_ != NULL; }

bool
ServiceRef::HasInstance(v8::Handle<v8::Value> value) {
  if ( ! value->IsObject() ) return false;
  v8::Local<v8::Object> object = value->ToObject();
  return constructor_template->HasInstance( object );
}

void
ServiceRef::SetCallback(v8::Handle<v8::Function> callback) {
  if ( ! callback_.IsEmpty()) {
    callback_.Dispose();
  }
  callback_ = v8::Persistent<v8::Function>::New(callback);
}

v8::Handle<v8::Function>
ServiceRef::GetCallback() const { return callback_; }

DNSServiceRef &
ServiceRef::GetServiceRef() { return ref_; }

void
ServiceRef::SetServiceRef(DNSServiceRef ref) { ref_ = ref; }

v8::Handle<v8::Value>
ServiceRef::GetContext() { return context_; }

void
ServiceRef::SetContext(v8::Handle<v8::Value> context) {
  if ( ! context_.IsEmpty()) {
    context_.Dispose();
  }
  context_ = v8::Persistent<v8::Value>::New(context);
}

v8::Handle<v8::Object>
ServiceRef::GetThis() { return this_; }

void
ServiceRef::SetThis(v8::Local<v8::Object> This) { this_ = This; }

bool
ServiceRef::SetSocketFlags() {
    return true;
#if 0 // XXX I think IOWatcher does the right thing. TODO: check!
  int fd = DNSServiceRefSockFD(ref_);
  if (fd == -1) return false;
  return fcntl(fd, F_SETFD, FD_CLOEXEC) != -1 &&
    fcntl(fd, F_SETFL, O_NONBLOCK) != -1;
#endif
}

Handle<Value>
ServiceRef::fd_getter(Local<String> property, AccessorInfo const& info) {
    HandleScope scope;
    ServiceRef * service_ref = ObjectWrap::Unwrap<ServiceRef>(info.This());
    int fd = -1;
    if (service_ref->ref_) {
        fd = DNSServiceRefSockFD(service_ref->ref_);
        if (fd == -1) {
            return ThrowException(Exception::Error(
                        String::New("DNSServiceRefSockFD() failed")));
        }
    }
    Local<Integer> v = Integer::New(fd);
    return scope.Close(v);
}

Handle<Value>
ServiceRef::initialized_getter(Local<String> property, AccessorInfo const& info) {
    HandleScope scope;
    ServiceRef * service_ref = ObjectWrap::Unwrap<ServiceRef>(info.This());
    return scope.Close(Boolean::New(service_ref->IsInitialized()));
}

} // end of namespace node_mdns
