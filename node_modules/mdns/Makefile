BUILDTYPE ?= Release

GCOV_OUT = build/reports/coverage/cpp
NCOV_OUT = build/reports/coverage

TEST_OPTIONS=

ifdef PULSE_BUILD_NUMBER
  TEST_OPTIONS= --ascii --verbose
endif

all: bindings

bindings:
	$(MAKE) -C build BUILDTYPE=$(BUILDTYPE)

test: bindings
	node --expose_gc utils/testrun $(TEST_OPTIONS)

coverage:
	$(MAKE) coverage_run BUILDTYPE=Coverage

coverage_build:
	$(MAKE) -C build BUILDTYPE=Coverage

jscoverage:
	jscoverage -v --no-highlight lib/ build/Coverage/lib

coverage_run: coverage_build jscoverage
	lcov -d build/$(BUILDTYPE)/obj.target/dns_sd_bindings/src --zerocounters
	mkdir -p $(GCOV_OUT)/html; 
	NCOV_OUT=$(NCOV_OUT) node --expose_gc utils/testrun $(TEST_OPTIONS)
	lcov --base-directory build \
		 --directory      build/$(BUILDTYPE)/obj.target/dns_sd_bindings/src \
		 --output-file    $(GCOV_OUT)/testrun_all.info \
		 --capture
	utils/ncov
	lcov --output-file    $(GCOV_OUT)/testrun.info \
		 --extract \
		 $(GCOV_OUT)/testrun_all.info "$(abspath .)/*" \
	   | tee $(GCOV_OUT)/lcov.log 
	genhtml --output-directory $(GCOV_OUT)/html \
	        --demangle-cpp \
			$(GCOV_OUT)/testrun.info
	tail -n 3 $(GCOV_OUT)/lcov.log | utils/coverage > $(GCOV_OUT)/coverage.properties

doc:
	utils/docpack

website:
	echo TODO

.PHONY: test citest coverage coverage_build coverage_run bindings jscoverage doc website 

