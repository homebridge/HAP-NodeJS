NACLRAW=nacl_raw.js
NACLVERSION=20110221+Ed25519-20130419
NACLUNPACKED=nacl-$(NACLVERSION)

PYTHON=python
EMCC=`which emcc`

test: all
	npm test

## Builds well with emscripten of August 8, 2013 or newer and Clang/LLVM 3.2.
all: lib


$(NACLRAW): subnacl
	EMCC_DEBUG=2 $(PYTHON) $(EMCC) \
		-s LINKABLE=1 \
		-s EXPORTED_FUNCTIONS="$$(cat subnacl/naclexports.sh)" \
		--js-library nacl_randombytes_emscripten.js \
		--post-js subnacl/naclapi.js \
		-O2 --closure 1 -o $@ \
		-I subnacl/include \
		keys.c \
		$$(find subnacl -name '*.c')

clean:
	rm -f $(NACLRAW)
	rm -rf lib

lib: $(NACLRAW) nacl_cooked_prefix.js nacl_cooked.js nacl_cooked_suffix.js
	mkdir -p $@
	cat nacl_cooked_prefix.js $(NACLRAW) nacl_cooked.js nacl_cooked_suffix.js \
		> $@/nacl_factory.js

veryclean: clean
	rm -rf subnacl
	rm -rf $(NACLUNPACKED)

subnacl: import.py
	tar -jxvf $(NACLUNPACKED).tar.bz2
	python import.py $(NACLUNPACKED)
