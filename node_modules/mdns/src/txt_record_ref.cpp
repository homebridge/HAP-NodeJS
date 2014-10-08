#include "mdns.hpp"

#include "txt_record_ref.hpp"

using namespace v8;

namespace node_mdns {

Persistent<FunctionTemplate> TxtRecordRef::constructor_template;

TxtRecordRef::TxtRecordRef() :
    ref_()
{
}

TxtRecordRef::~TxtRecordRef() {
    TXTRecordDeallocate( & ref_);
}

void
TxtRecordRef::Initialize(Handle<Object> target) {
    Local<FunctionTemplate> t = FunctionTemplate::New(New);
    constructor_template = Persistent<FunctionTemplate>::New(t);
    constructor_template->InstanceTemplate()->SetInternalFieldCount(1);
    constructor_template->SetClassName(String::NewSymbol("TXTRecordRef"));

    target->Set(String::NewSymbol("TXTRecordRef"),
            constructor_template->GetFunction());
}

Handle<Value>
TxtRecordRef::New(const Arguments & args) {
    HandleScope scope;
    TxtRecordRef * o = new TxtRecordRef();
    o->Wrap(args.Holder());
    return args.This();
}

} // end of namespace node_mdns
