#include <stdint.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <iostream>

#include <v8.h>
#include <node.h>
#include <openssl/bn.h>
#include <map>
#include <utility>

using namespace v8;
using namespace node;
using namespace std;

#define REQ_STR_ARG(I, VAR)                                   \
  if (args.Length()<= (I) || !args[I]->IsString())            \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be a string")));      \
  Local<String> VAR = Local<String>::Cast(args[I]);

#define REQ_UTF8_ARG(I, VAR)                                  \
  if (args.Length() <= (I) || !args[I]->IsString())           \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be a utf8 string"))); \
  String::Utf8Value VAR(args[I]->ToString());

#define REQ_INT32_ARG(I, VAR)                                 \
  if (args.Length() <= (I) || !args[I]->IsInt32())            \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be an int32")));      \
  int32_t VAR = args[I]->ToInt32()->Value();

#define REQ_UINT32_ARG(I, VAR)                                \
  if (args.Length() <= (I) || !args[I]->IsUint32())           \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be a uint32")));      \
  uint32_t VAR = args[I]->ToUint32()->Value();

#define REQ_INT64_ARG(I, VAR)                                 \
  if (args.Length() <= (I) || !args[I]->IsNumber())           \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be an int64")));      \
  int64_t VAR = args[I]->ToInteger()->Value();

#define REQ_UINT64_ARG(I, VAR)                                \
  if (args.Length() <= (I) || !args[I]->IsNumber())           \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be a uint64")));      \
  uint64_t VAR = args[I]->ToInteger()->Value();

#define REQ_BOOL_ARG(I, VAR)                                  \
  if (args.Length() <= (I) || !args[I]->IsBoolean())          \
    return ThrowException(Exception::TypeError(               \
      String::New("Argument " #I " must be a boolean")));     \
  bool VAR = args[I]->ToBoolean()->Value();

#define WRAP_RESULT(RES, VAR)                                           \
  Handle<Value> arg[1] = { External::New(static_cast<BigNum*>(RES)) };  \
  Local<Object> VAR = constructor_template->GetFunction()->NewInstance(1, arg);

class AutoBN_CTX
{
protected:
  BN_CTX* ctx;
  BN_CTX* operator=(BN_CTX* ctx_new) { return ctx = ctx_new; }

public:
  AutoBN_CTX()
  {
    ctx = BN_CTX_new();
    // TODO: Handle ctx == NULL
  }

  ~AutoBN_CTX()
  {
    if (ctx != NULL)
      BN_CTX_free(ctx);
  }

  operator BN_CTX*() { return ctx; }
  BN_CTX& operator*() { return *ctx; }
  BN_CTX** operator&() { return &ctx; }
  bool operator!() { return (ctx == NULL); }
};

/**
 * BN_jacobi_priv() computes the Jacobi symbol of A with respect to N.
 *
 * Hence, *jacobi = 1 when the jacobi symbol is unity and *jacobi = -1 when the
 * jacobi symbol is -1. N must be odd and >= 3. It is required that 0 <= A < N.
 *
 * When successful 0 is returned. -1 is returned on failure.
 *
 * This is an implementation of an iterative version of Algorithm 2.149 on page
 * 73 of the book "Handbook of Applied Cryptography" by Menezes, Oorshot,
 * Vanstone. Note that there is a typo in step 1. Step 1 should return the value
 * 1. The algorithm has a running time of O((lg N)^2) bit operations.
 *
 * @author Adam L. Young
 */
int BN_jacobi_priv(const BIGNUM *A,const BIGNUM *N,int *jacobi,
                   BN_CTX *ctx)
{
  int e,returnvalue=0,s,bit0,bit1,bit2,a1bit0,a1bit1;
  BIGNUM *zero,*a1,*n1,*three,*tmp;

  if (!jacobi)
    return -1;
  *jacobi = 1;
  if ((!A) || (!N) || (!ctx))
    return -1;
  if (!BN_is_odd(N))
    return -1; /* ERROR: BN_jacobi() given an even N */
  if (BN_cmp(A,N) >= 0)
    return -1;
  n1=BN_new();zero=BN_new();a1=BN_new();three=BN_new();tmp=BN_new();
  BN_set_word(zero,0);
  BN_set_word(three,3);
  if (BN_cmp(N,three) < 0)
	{ /* This function was written by Adam L. Young */
    returnvalue = -1;
    goto endBN_jacobi;
	}
  if (BN_cmp(zero,A) > 0)
	{
    returnvalue = -1;
    goto endBN_jacobi;
	}
  BN_copy(a1,A);
  BN_copy(n1,N);
startjacobistep1:
  if (BN_is_zero(a1)) /* step 1 */
    goto endBN_jacobi;  /* *jacobi = 1; */
  if (BN_is_one(a1)) /* step 2 */
    goto endBN_jacobi;  /* *jacobi = 1; */
  for (e=0;;e++) /*  step 3 */
    if (BN_is_odd(a1))
      break;
    else
      BN_rshift1(a1,a1);
  s = 1; /* step 4 */
  bit0 = BN_is_odd(n1);
  bit1 = BN_is_bit_set(n1,1);
  if (e % 2)
	{
    bit2 = BN_is_bit_set(n1,2);
    if ((!bit2) && (bit1) && (bit0))
      s = -1;
    if ((bit2) && (!bit1) && (bit0))
      s = -1;
	}
  a1bit0 = BN_is_odd(a1);  /* step 5 */
  a1bit1 = BN_is_bit_set(a1,1);
  if (((bit1) && (bit0)) && ((a1bit1) && (a1bit0)))
    s = -s;
  BN_mod(n1,n1,a1,ctx); /* step 6 */
  BN_copy(tmp,a1);
  BN_copy(a1,n1);
  BN_copy(n1,tmp);
  *jacobi *= s;  /*  step 7 */
  goto startjacobistep1;
endBN_jacobi:
  BN_clear_free(zero);
  BN_clear_free(tmp);BN_clear_free(a1);
  BN_clear_free(n1);BN_clear_free(three);
  return returnvalue;
}

class BigNum : ObjectWrap {
public:
  static void Initialize(Handle<Object> target);
  BIGNUM bignum_;
  static Persistent<Function> js_conditioner;
  static void SetJSConditioner(Persistent<Function> constructor);

protected:
  static Persistent<FunctionTemplate> constructor_template;

  BigNum(const String::Utf8Value& str, uint64_t base);
  BigNum(uint64_t num);
  BigNum(int64_t num);
  BigNum(BIGNUM *num);
  BigNum();
  ~BigNum();

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> ToString(const Arguments& args);
  static Handle<Value> Badd(const Arguments& args);
  static Handle<Value> Bsub(const Arguments& args);
  static Handle<Value> Bmul(const Arguments& args);
  static Handle<Value> Bdiv(const Arguments& args);
  static Handle<Value> Uadd(const Arguments& args);
  static Handle<Value> Usub(const Arguments& args);
  static Handle<Value> Umul(const Arguments& args);
  static Handle<Value> Udiv(const Arguments& args);
  static Handle<Value> Umul_2exp(const Arguments& args);
  static Handle<Value> Udiv_2exp(const Arguments& args);
  static Handle<Value> Babs(const Arguments& args);
  static Handle<Value> Bneg(const Arguments& args);
  static Handle<Value> Bmod(const Arguments& args);
  static Handle<Value> Umod(const Arguments& args);
  static Handle<Value> Bpowm(const Arguments& args);
  static Handle<Value> Upowm(const Arguments& args);
  static Handle<Value> Upow(const Arguments& args);
  static Handle<Value> Uupow(const Arguments& args);
  static Handle<Value> Brand0(const Arguments& args);
  static Handle<Value> Uprime0(const Arguments& args);
  static Handle<Value> Probprime(const Arguments& args);
  static Handle<Value> Bcompare(const Arguments& args);
  static Handle<Value> Scompare(const Arguments& args);
  static Handle<Value> Ucompare(const Arguments& args);
  static Handle<Value> Bop(const Arguments& args, int op);
  static Handle<Value> Band(const Arguments& args);
  static Handle<Value> Bor(const Arguments& args);
  static Handle<Value> Bxor(const Arguments& args);
  static Handle<Value> Binvertm(const Arguments& args);
  static Handle<Value> Bsqrt(const Arguments& args);
  static Handle<Value> Broot(const Arguments& args);
  static Handle<Value> BitLength(const Arguments& args);
  static Handle<Value> Bgcd(const Arguments& args);
  static Handle<Value> Bjacobi(const Arguments& args);
};

Persistent<FunctionTemplate> BigNum::constructor_template;

Persistent<Function> BigNum::js_conditioner;

void BigNum::SetJSConditioner(Persistent<Function> constructor) {
  js_conditioner = constructor;
}

void BigNum::Initialize(v8::Handle<v8::Object> target) {
  HandleScope scope;

  Local<FunctionTemplate> t = FunctionTemplate::New(New);
  constructor_template = Persistent<FunctionTemplate>::New(t);

  constructor_template->InstanceTemplate()->SetInternalFieldCount(1);
  constructor_template->SetClassName(String::NewSymbol("BigNum"));

  NODE_SET_METHOD(constructor_template, "uprime0", Uprime0);

  NODE_SET_PROTOTYPE_METHOD(constructor_template, "tostring", ToString);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "badd", Badd);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bsub", Bsub);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bmul", Bmul);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bdiv", Bdiv);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "uadd", Uadd);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "usub", Usub);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "umul", Umul);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "udiv", Udiv);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "umul2exp", Umul_2exp);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "udiv2exp", Udiv_2exp);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "babs", Babs);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bneg", Bneg);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bmod", Bmod);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "umod", Umod);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bpowm", Bpowm);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "upowm", Upowm);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "upow", Upow);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "brand0", Brand0);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "probprime", Probprime);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bcompare", Bcompare);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "scompare", Scompare);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "ucompare", Ucompare);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "band", Band);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bor", Bor);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bxor", Bxor);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "binvertm", Binvertm);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bsqrt", Bsqrt);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "broot", Broot);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "bitLength", BitLength);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "gcd", Bgcd);
  NODE_SET_PROTOTYPE_METHOD(constructor_template, "jacobi", Bjacobi);

  target->Set(String::NewSymbol("BigNum"), constructor_template->GetFunction());
}

BigNum::BigNum(const v8::String::Utf8Value& str, uint64_t base) : ObjectWrap ()
{
  BN_init(&bignum_);
  BN_zero(&bignum_);

  BIGNUM *res = &bignum_;

  const char *cstr = *str;
  switch (base) {
  case 2:
    BN_init(&bignum_);
    for (int i = 0, l = str.length(); i < l; i++) {
      if (cstr[l-i-1] != '0') {
        BN_set_bit(&bignum_, i);
      }
    }
    break;
  case 10:
    BN_dec2bn(&res, cstr);
    break;
  case 16:
    BN_hex2bn(&res, cstr);
    break;
  default:
    ThrowException(Exception::Error(String::New("Invalid base, only 10 and 16 are supported")));
    return;
  }
}

BigNum::BigNum(uint64_t num) : ObjectWrap ()
{
  BN_init(&bignum_);

  BN_set_word(&bignum_, num);
}

BigNum::BigNum(int64_t num) : ObjectWrap ()
{
  BN_init(&bignum_);

  if (num > 0) {
    BN_set_word(&bignum_, num);
  } else {
    BN_set_word(&bignum_, -num);
    BN_set_negative(&bignum_, 1);
  }
}

BigNum::BigNum(BIGNUM *num) : ObjectWrap ()
{
  BN_init(&bignum_);
  BN_copy(&bignum_, num);
}

BigNum::BigNum() : ObjectWrap ()
{
  BN_init(&bignum_);
  BN_zero(&bignum_);
}

BigNum::~BigNum()
{
  BN_clear_free(&bignum_);
}

Handle<Value>
BigNum::New(const Arguments& args)
{
  if (!args.IsConstructCall()) {
    int len = args.Length();
    Handle<Value>* newArgs = new Handle<Value>[len];
    for (int i = 0; i < len; i++) {
      newArgs[i] = args[i];
    }
    Handle<Value> newInst = constructor_template->GetFunction()->NewInstance(len, newArgs);
    delete[] newArgs;
    return newInst;
  }
  HandleScope scope;
  BigNum *bignum;
  uint64_t base;

  if (args[0]->IsExternal()) {
    bignum = static_cast<BigNum*>(External::Cast(*(args[0]))->Value());
  } else {
    int len = args.Length();
    Local<Object> ctx = Local<Object>::New(Object::New());
    Handle<Value>* newArgs = new Handle<Value>[len];
    for (int i = 0; i < len; i++) {
      newArgs[i] = args[i];
    }
    Local<Value> obj = js_conditioner->Call(ctx, args.Length(), newArgs);
    delete[] newArgs;

    if (!*obj) {
      return ThrowException(Exception::Error(String::New("Invalid type passed to bignum constructor")));
    }

    String::Utf8Value str(obj->ToObject()->Get(String::NewSymbol("num"))->ToString());
    base = obj->ToObject()->Get(String::NewSymbol("base"))->ToNumber()->Value();

    bignum = new BigNum(str, base);
  }

  bignum->Wrap(args.This());

  return scope.Close(args.This());
}

Handle<Value>
BigNum::ToString(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  uint64_t base = 10;

  if (args.Length() > 0) {
    REQ_UINT64_ARG(0, tbase);
    base = tbase;
  }
  char *to = NULL;
  switch (base) {
  case 10:
    to = BN_bn2dec(&bignum->bignum_);
    break;
  case 16:
    to = BN_bn2hex(&bignum->bignum_);
    break;
  default:
    return ThrowException(Exception::Error(String::New("Invalid base, only 10 and 16 are supported")));
  }

  Handle<Value> result = String::New(to);
  free(to);

  return scope.Close(result);
}

Handle<Value>
BigNum::Badd(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();

  BN_add(&res->bignum_, &bignum->bignum_, &bn->bignum_);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bsub(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();
  BN_sub(&res->bignum_, &bignum->bignum_, &bn->bignum_);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bmul(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();
  BN_mul(&res->bignum_, &bignum->bignum_, &bn->bignum_, ctx);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bdiv(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bi = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();
  BN_div(&res->bignum_, NULL, &bignum->bignum_, &bi->bignum_, ctx);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Uadd(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum(&bignum->bignum_);
  BN_add_word(&res->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Usub(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum(&bignum->bignum_);
  BN_sub_word(&res->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Umul(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum(&bignum->bignum_);
  BN_mul_word(&res->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Udiv(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum(&bignum->bignum_);
  BN_div_word(&res->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Umul_2exp(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum();
  BN_lshift(&res->bignum_, &bignum->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Udiv_2exp(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum();
  BN_rshift(&res->bignum_, &bignum->bignum_, x);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Babs(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *res = new BigNum(&bignum->bignum_);
  BN_set_negative(&res->bignum_, 0);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bneg(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *res = new BigNum(&bignum->bignum_);
  BN_set_negative(&res->bignum_, !BN_is_negative(&res->bignum_));

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bmod(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();
  BN_div(NULL, &res->bignum_, &bignum->bignum_, &bn->bignum_, ctx);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Umod(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *res = new BigNum();
  BN_set_word(&res->bignum_, BN_mod_word(&bignum->bignum_, x));

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bpowm(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn1 = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *bn2 = ObjectWrap::Unwrap<BigNum>(args[1]->ToObject());
  BigNum *res = new BigNum();
  BN_mod_exp(&res->bignum_, &bignum->bignum_, &bn1->bignum_, &bn2->bignum_, ctx);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Upowm(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[1]->ToObject());
  BIGNUM exp;
  BN_init(&exp);
  BN_set_word(&exp, x);

  BigNum *res = new BigNum();
  BN_mod_exp(&res->bignum_, &bignum->bignum_, &exp, &bn->bignum_, ctx);

  BN_clear_free(&exp);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Upow(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BIGNUM exp;
  BN_init(&exp);
  BN_set_word(&exp, x);

  BigNum *res = new BigNum();
  BN_exp(&res->bignum_, &bignum->bignum_, &exp, ctx);

  BN_clear_free(&exp);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Brand0(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *res = new BigNum();

  BN_rand_range(&res->bignum_, &bignum->bignum_);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Uprime0(const Arguments& args)
{
  HandleScope scope;

  REQ_UINT32_ARG(0, x);
  REQ_BOOL_ARG(1, safe);

  BigNum *res = new BigNum();

  BN_generate_prime_ex(&res->bignum_, x, safe, NULL, NULL, NULL);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Probprime(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT32_ARG(0, reps);

  return scope.Close(Number::New(BN_is_prime_ex(&bignum->bignum_, reps, ctx, NULL)));
}

Handle<Value>
BigNum::Bcompare(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());

  return scope.Close(Number::New(BN_cmp(&bignum->bignum_, &bn->bignum_)));
}

Handle<Value>
BigNum::Scompare(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_INT64_ARG(0, x);
  BIGNUM bn;
  BN_init(&bn);
  if (x > 0) {
    BN_set_word(&bn, x);
  } else {
    BN_set_word(&bn, -x);
    BN_set_negative(&bn, 1);
  }
  int res = BN_cmp(&bignum->bignum_, &bn);
  BN_clear_free(&bn);

  return scope.Close(Number::New(res));
}

Handle<Value>
BigNum::Ucompare(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  REQ_UINT64_ARG(0, x);
  BIGNUM bn;
  BN_init(&bn);
  BN_set_word(&bn, x);
  int res = BN_cmp(&bignum->bignum_, &bn);
  BN_clear_free(&bn);

  return scope.Close(Number::New(res));
}

Handle<Value>
BigNum::Bop(const Arguments& args, int op)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  HandleScope scope;

  if (BN_is_negative(&bignum->bignum_) || BN_is_negative(&bn->bignum_)) {
    // Using BN_bn2mpi and BN_bn2mpi would make this more manageable; added in SSLeay 0.9.0
    return ThrowException(Exception::Error(String::New("Bitwise operations on negative numbers are not supported")));
  }

  BigNum *res = new BigNum();

  // Modified from https://github.com/Worlize/WebSocket-Node/blob/master/src/xor.cpp
  // Portions Copyright (c) Agora S.A.
  // Licensed under the MIT License.

  int payloadSize = BN_num_bytes(&bignum->bignum_);
  int maskSize = BN_num_bytes(&bn->bignum_);

  int size = max(payloadSize, maskSize);
  int offset = abs(payloadSize - maskSize);

  int payloadOffset = 0;
  int maskOffset = 0;

  if (payloadSize < maskSize) {
    payloadOffset = offset;
  } else if (payloadSize > maskSize) {
    maskOffset = offset;
  }

  uint8_t* payload = (uint8_t*) calloc(size, sizeof(char));
  uint8_t* mask = (uint8_t*) calloc(size, sizeof(char));

  BN_bn2bin(&bignum->bignum_, (unsigned char*) (payload + payloadOffset));
  BN_bn2bin(&bn->bignum_, (unsigned char*) (mask + maskOffset));

  uint32_t* pos32 = (uint32_t*) payload;
  uint32_t* end32 = pos32 + (size / 4);
  uint32_t* mask32 = (uint32_t*) mask;

  switch (op) {
    case 0: while (pos32 < end32) *(pos32++) &= *(mask32++); break;
    case 1: while (pos32 < end32) *(pos32++) |= *(mask32++); break;
    case 2: while (pos32 < end32) *(pos32++) ^= *(mask32++); break;
  }

  uint8_t* pos8 = (uint8_t*) pos32;
  uint8_t* end8 = payload + size;
  uint8_t* mask8 = (uint8_t*) mask32;

  switch (op) {
    case 0: while (pos8 < end8) *(pos8++) &= *(mask8++); break;
    case 1: while (pos8 < end8) *(pos8++) |= *(mask8++); break;
    case 2: while (pos8 < end8) *(pos8++) ^= *(mask8++); break;
  }

  BN_bin2bn((unsigned char*) payload, size, &res->bignum_);

  WRAP_RESULT(res, result);

  free(payload);
  free(mask);

  return scope.Close(result);
}

Handle<Value>
BigNum::Band(const Arguments& args)
{
  return Bop(args, 0);
}

Handle<Value>
BigNum::Bor(const Arguments& args)
{
  return Bop(args, 1);
}

Handle<Value>
BigNum::Bxor(const Arguments& args)
{
  return Bop(args, 2);
}

Handle<Value>
BigNum::Binvertm(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();
  BN_mod_inverse(&res->bignum_, &bignum->bignum_, &bn->bignum_, ctx);

  WRAP_RESULT(res, result);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bsqrt(const Arguments& args)
{
  //BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  return ThrowException(Exception::Error(String::New("sqrt is not supported by OpenSSL.")));
}

Handle<Value>
BigNum::Broot(const Arguments& args)
{
  //BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  return ThrowException(Exception::Error(String::New("root is not supported by OpenSSL.")));
}

Handle<Value>
BigNum::BitLength(const Arguments& args)
{
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  int size = BN_num_bits(&bignum->bignum_);
  Handle<Value> result = Integer::New(size);

  return scope.Close(result);
}

Handle<Value>
BigNum::Bgcd(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bignum = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bi = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  BigNum *res = new BigNum();

  BN_gcd(&res->bignum_, &bignum->bignum_, &bi->bignum_, ctx);

  WRAP_RESULT(res, result);
  return scope.Close(result);
}

Handle<Value>
BigNum::Bjacobi(const Arguments& args)
{
  AutoBN_CTX ctx;
  BigNum *bn_a = ObjectWrap::Unwrap<BigNum>(args.This());
  HandleScope scope;

  BigNum *bn_n = ObjectWrap::Unwrap<BigNum>(args[0]->ToObject());
  int res = 0;

  if (BN_jacobi_priv(&bn_a->bignum_, &bn_n->bignum_, &res, ctx) == -1)
    return ThrowException(Exception::Error(String::New(
        "Jacobi symbol calculation failed")));

  return scope.Close(Integer::New(res));
}

static Handle<Value>
SetJSConditioner(const Arguments& args)
{
  HandleScope scope;

  BigNum::SetJSConditioner(Persistent<Function>::New(Local<Function>::Cast(args[0])));

  return Undefined();
}

extern "C" void
init (Handle<Object> target)
{
  HandleScope scope;

  BigNum::Initialize(target);
  NODE_SET_METHOD(target, "setJSConditioner", SetJSConditioner);
}

NODE_MODULE(bignum, init)
