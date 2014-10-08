#include "mdns.hpp"

// poor mans conditional compilation. is there a better way to do this with gyp?
#ifdef NODE_MDNS_USE_SOCKET_WATCHER

#include "socket_watcher.hpp"

#include <string.h> // needed for memset() with node v0.7.9 on Mac OS
#include <node.h>
#include <node_version.h>

using namespace v8;

#if ! NODE_VERSION_AT_LEAST(0, 7, 8)
namespace node {

Handle<Value>
MakeCallback(const Handle<Object> object, const Handle<Function> callback,
        int argc, Handle<Value> argv[])
{
    HandleScope scope;

    // TODO Hook for long stack traces to be made here.

    TryCatch try_catch;

    Local<Value> ret = callback->Call(object, argc, argv);

    if (try_catch.HasCaught()) {
        FatalException(try_catch);
        return Undefined();
    }

    return scope.Close(ret);
}

}  // end of namespace node
#endif

namespace node_mdns {

    Persistent<String> callback_symbol;

    SocketWatcher::SocketWatcher() : poll_(NULL), fd_(0), events_(0) {
    }

    void
    SocketWatcher::Initialize(Handle<Object> target) {
        Local<FunctionTemplate> t = FunctionTemplate::New(New);

        Local<String> symbol = String::NewSymbol("SocketWatcher");
        t->SetClassName(symbol);
        t->InstanceTemplate()->SetInternalFieldCount(1);

        NODE_SET_PROTOTYPE_METHOD(t, "set", SocketWatcher::Set);
        NODE_SET_PROTOTYPE_METHOD(t, "start", SocketWatcher::Start);
        NODE_SET_PROTOTYPE_METHOD(t, "stop", SocketWatcher::Stop);

        target->Set(symbol, t->GetFunction());

        callback_symbol = NODE_PSYMBOL("callback");
    }

    Handle<Value>
    SocketWatcher::Start(const Arguments& args) {
        HandleScope scope;
        SocketWatcher *watcher = ObjectWrap::Unwrap<SocketWatcher>(args.Holder());
        watcher->Start();
        return Undefined();
    }

    void
    SocketWatcher::Start() {
        if (poll_ == NULL) {
            poll_ = new uv_poll_t;
            memset(poll_,0,sizeof(uv_poll_t));
            poll_->data = this;
            uv_poll_init_socket(uv_default_loop(), poll_, fd_);

            Ref();
        }

        if (!uv_is_active((uv_handle_t*)poll_)) {
            uv_poll_start(poll_, events_, &SocketWatcher::Callback);
        }
    }

    void
    SocketWatcher::Callback(uv_poll_t *w, int status, int revents) {
        HandleScope scope;

        SocketWatcher *watcher = static_cast<SocketWatcher*>(w->data);
        assert(w == watcher->poll_);

        Local<Value> callback_v = watcher->handle_->Get(callback_symbol);
        if (!callback_v->IsFunction()) {
            watcher->Stop();
            return;
        }

        Local<Function> callback = Local<Function>::Cast(callback_v);

        Local<Value> argv[2];
        argv[0] = Local<Value>::New(revents & UV_READABLE ? True() : False());
        argv[1] = Local<Value>::New(revents & UV_WRITABLE ? True() : False());

        node::MakeCallback(watcher->handle_, callback, 2, argv);
    }

    Handle<Value>
    SocketWatcher::Stop(const Arguments& args) {
        HandleScope scope;
        SocketWatcher *watcher = ObjectWrap::Unwrap<SocketWatcher>(args.Holder());
        watcher->Stop();
        return Undefined();
    }

    void
    SocketWatcher::Stop() {
        if (poll_ != NULL) {
            uv_poll_stop(poll_);
            Unref();
        }
    }

    v8::Handle<v8::Value>
    SocketWatcher::New(const v8::Arguments & args) {
        HandleScope scope;
        SocketWatcher *s = new SocketWatcher();
        s->Wrap(args.This());
        return args.This();
    }

    Handle<Value>
    SocketWatcher::Set(const Arguments& args) {
        HandleScope scope;
        SocketWatcher *watcher = ObjectWrap::Unwrap<SocketWatcher>(args.Holder());
        if (!args[0]->IsInt32()) {
            return ThrowException(Exception::TypeError(
                String::New("First arg should be a file descriptor.")));
        }
        int fd = args[0]->Int32Value();
        if (!args[1]->IsBoolean()) {
            return ThrowException(Exception::TypeError(
                String::New("Second arg should boolean (readable).")));
        }
        int events = 0;

        if (args[1]->IsTrue()) events |= UV_READABLE;

        if (!args[2]->IsBoolean()) {
            return ThrowException(Exception::TypeError(
                String::New("Third arg should boolean (writable).")));
        }

        if (args[2]->IsTrue()) events |= UV_WRITABLE;

        assert(watcher->poll_ == NULL);

        watcher->fd_ = fd;
        watcher->events_ = events;

        return Undefined();
    }

} // end of namespace node_mdns

#endif // NODE_MDNS_USE_SOCKET_WATCHER
