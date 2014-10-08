#ifndef NODE_MDNS_SOCKET_WATCHER_INCLUDED
#define NODE_MDNS_SOCKET_WATCHER_INCLUDED

namespace node_mdns {

class SocketWatcher : public node::ObjectWrap {
    public:
        SocketWatcher();

        static void Initialize(v8::Handle<v8::Object> target);

    private:
        uv_poll_t* poll_;
        int fd_;
        int events_;

        static v8::Handle<v8::Value> New(const v8::Arguments & args);
        static v8::Handle<v8::Value> Set(const v8::Arguments & args);
        static v8::Handle<v8::Value> Start(const v8::Arguments& args);
        static v8::Handle<v8::Value> Stop(const v8::Arguments& args);
        
        void Start();
        void Stop();
        static void Callback(uv_poll_t *w, int status, int events);
};

} // end of namespace node_mdns

#endif // NODE_MDNS_SOCKET_WATCHER_INCLUDED
