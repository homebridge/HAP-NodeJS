#ifndef NODE_MDNS_TXT_RECORD_REF_INCLUDED
#define NODE_MDNS_TXT_RECORD_REF_INCLUDED

namespace node_mdns {

class TxtRecordRef : public node::ObjectWrap {
    public:
        TxtRecordRef();
        ~TxtRecordRef();

        static void Initialize(v8::Handle<v8::Object> target);
        static v8::Handle<v8::Value> New(const v8::Arguments & args);

        //inline bool IsInitialized() const { return ref_ != NULL; }

        static inline bool HasInstance(v8::Handle<v8::Value> value) {
            if ( ! value->IsObject() ) return false;
            v8::Local<v8::Object> object = value->ToObject();
            return constructor_template->HasInstance( object );
        }

        TXTRecordRef & GetTxtRecordRef() { return ref_; }
        void SetTxtRecordRef(TXTRecordRef ref) { ref_ = ref; }

    private:
        TXTRecordRef ref_;

        static v8::Persistent<v8::FunctionTemplate> constructor_template;
};

} // end of namespace node_mdns
#endif // NODE_MDNS_TXT_RECORD_REF_INCLUDED
