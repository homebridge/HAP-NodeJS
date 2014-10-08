#include <v8.h>
#include <node.h>
#include <node_buffer.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include "curve25519-donna.c"

using namespace std;
using namespace node;
using namespace v8;

static Handle<Value> DoCurve (const Arguments&);
extern "C" void init (Handle<Object>);

static Handle<Value> DoCurve (const Arguments& args) {
  HandleScope scope;
  const char *usage = "usage: curve(a, b, c)";
  if (args.Length() != 3) {
    return ThrowException(Exception::Error(String::New(usage)));
  }
  unsigned char* arg0 = (unsigned char*) Buffer::Data(args[0]->ToObject());
  unsigned char* arg1 = (unsigned char*) Buffer::Data(args[1]->ToObject());
  unsigned char* arg2 = (unsigned char*) Buffer::Data(args[2]->ToObject());
  curve25519_donna(arg0, arg1, arg2);
  return Undefined();
}

extern "C" void init (Handle<Object> target) {
  HandleScope scope;
  NODE_SET_METHOD(target, "curve", DoCurve);
}


NODE_MODULE(curve, init)
