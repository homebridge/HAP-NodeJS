#include <node.h>
#include <node_buffer.h>
#include "ed25519/ed25519.h"

using namespace v8;
using namespace node;

//Helper function
static Handle<Value> V8Exception(const char* msg) {
	return ThrowException(Exception::Error(String::New(msg)));
}

/**
 * MakeKeypair(Buffer seed)
 * seed: A 32 byte buffer
 * returns: an Object with PublicKey and PrivateKey
 **/
Handle<Value> MakeKeypair(const Arguments& args) {
	HandleScope scope;
	if ((args.Length() < 1) || (!Buffer::HasInstance(args[0])) || (Buffer::Length(args[0]->ToObject()) != 32)) {
		return V8Exception("MakeKeypair requires a 32 byte buffer");
	}
	const unsigned char* seed = (unsigned char*)Buffer::Data(args[0]->ToObject());
	Buffer* privateKey = Buffer::New(64);
	unsigned char* privateKeyData = (unsigned char*)Buffer::Data(privateKey);
	Buffer* publicKey = Buffer::New(32);
	unsigned char* publicKeyData = (unsigned char*)Buffer::Data(publicKey);
	for (int i = 0; i < 32; i++)
		privateKeyData[i] = seed[i];
	crypto_sign_keypair(publicKeyData, privateKeyData);

	Local<Object> result = Object::New();
	result->Set(String::NewSymbol("publicKey"), Local<Object>::New(publicKey->handle_));
	result->Set(String::NewSymbol("privateKey"), Local<Object>::New(privateKey->handle_));
	return scope.Close(result);
}

/**
 * Sign(Buffer message, Buffer seed)
 * Sign(Buffer message, Buffer privateKey)
 * Sign(Buffer message, Object keyPair)
 * message: the message to be signed
 * seed: 32 byte buffer to make a keypair
 * keyPair: the object from the MakeKeypair function
 * returns: the signature as a Buffer
 **/
Handle<Value> Sign(const Arguments& args) {
	HandleScope scope;
	if ((args.Length() < 2) || (!Buffer::HasInstance(args[0]->ToObject()))) {
		return V8Exception("Sign requires (Buffer, {Buffer(32 or 64) | keyPair object})");
	}
	unsigned char* privateKey;
	if ((Buffer::HasInstance(args[1])) && (Buffer::Length(args[1]->ToObject()) == 32)) {
		unsigned char* seed = (unsigned char*)Buffer::Data(args[1]->ToObject());
		unsigned char publicKeyData[32];
		unsigned char privateKeyData[64];
		for (int i = 0; i < 32; i++) {
			privateKeyData[i] = seed[i];
		}
		crypto_sign_keypair(publicKeyData, privateKeyData);
		privateKey = privateKeyData;
	} else if ((Buffer::HasInstance(args[1])) && (Buffer::Length(args[1]->ToObject()) == 64)) {
		privateKey = (unsigned char*)Buffer::Data(args[1]->ToObject());
	} else if ((args[1]->IsObject()) && (!Buffer::HasInstance(args[1]))) {
		Handle<Object> privateKeyBuffer = args[1]->ToObject()->Get(String::New("privateKey"))->ToObject();
		if (!Buffer::HasInstance(privateKeyBuffer)) {
			return V8Exception("Sign requires (Buffer, {Buffer(32 or 64) | keyPair object})");
		}
		privateKey = (unsigned char*)Buffer::Data(privateKeyBuffer);
	} else {
		return V8Exception("Sign requires (Buffer, {Buffer(32 or 64) | keyPair object})");
	}
	Handle<Object> message = args[0]->ToObject();
	const unsigned char* messageData = (unsigned char*)Buffer::Data(message);
	size_t messageLen = Buffer::Length(message);
	unsigned long long sigLen = 64 + messageLen;
	unsigned char signatureMessageData[sigLen];
	crypto_sign(signatureMessageData, &sigLen, messageData, messageLen, privateKey);
	Buffer* signature = Buffer::New(64);
	unsigned char* signatureData = (unsigned char*)Buffer::Data(signature);
	for (int i = 0; i < 64; i++) {
		signatureData[i] = signatureMessageData[i];
	}
	return scope.Close(signature->handle_);
}

/**
 * Verify(Buffer message, Buffer signature, Buffer publicKey)
 * message: message the signature is for
 * signature: signature to be verified
 * publicKey: publicKey to the private key that created the signature
 * returns: boolean
 **/
Handle<Value> Verify(const Arguments& args) {
	HandleScope scope;
	if ((args.Length() < 3) || (!Buffer::HasInstance(args[0]->ToObject())) || 
		(!Buffer::HasInstance(args[1]->ToObject())) || (!Buffer::HasInstance(args[2]->ToObject()))) {
		return V8Exception("Verify requires (Buffer, Buffer(64), Buffer(32)");
	}
	Handle<Object> message = args[0]->ToObject();
	Handle<Object> signature = args[1]->ToObject();
	Handle<Object> publicKey = args[2]->ToObject();
	if ((Buffer::Length(signature) != 64) || (Buffer::Length(publicKey) != 32)) {
		return V8Exception("Verify requires (Buffer, Buffer(64), Buffer(32)");
	}
	unsigned char* messageData = (unsigned char*)Buffer::Data(message);
	size_t messageLen = Buffer::Length(message);
	unsigned char* signatureData = (unsigned char*)Buffer::Data(signature);
	unsigned char* publicKeyData = (unsigned char*)Buffer::Data(publicKey);
	return scope.Close(Boolean::New(crypto_sign_verify(signatureData, messageData, messageLen, publicKeyData) == 0));
}


void InitModule(Handle<Object> exports) {
	exports->Set(String::NewSymbol("MakeKeypair"), FunctionTemplate::New(MakeKeypair)->GetFunction());
	exports->Set(String::NewSymbol("Sign"), FunctionTemplate::New(Sign)->GetFunction());
	exports->Set(String::NewSymbol("Verify"), FunctionTemplate::New(Verify)->GetFunction());
}

NODE_MODULE(native, InitModule)

