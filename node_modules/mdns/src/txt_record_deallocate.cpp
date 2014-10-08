#include "mdns.hpp"

#include "mdns_utils.hpp"
#include "txt_record_ref.hpp"

using namespace v8;
using namespace node;

namespace node_mdns {

Handle<Value>
TXTRecordDeallocate(Arguments const& args) {
    HandleScope scope;
    if (argumentCountMismatch(args, 1)) {
        return throwArgumentCountMismatchException(args, 1);
    }
    if ( ! args[0]->IsObject() || ! TxtRecordRef::HasInstance(args[0]->ToObject())) {
        return throwTypeError("argument 1 must be a TXTRecordRef object");
    }

    TxtRecordRef * ref = ObjectWrap::Unwrap<TxtRecordRef>(args[0]->ToObject());
    TXTRecordDeallocate( & ref->GetTxtRecordRef());
    return Undefined();
}

} // end of namespace node_mdns
