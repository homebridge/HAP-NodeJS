# coding=utf-8
import csv
import sys
import math

class dialect(csv.excel):
    lineterminator = '\n'
    escapechar = '\\'
    pass

class NaclResults:
    def __init__(self, dataset, enginename):
        self.dataset = dataset
        (self.engine, self.version) = enginename.split('/')
        self.results = {}

    def setResult(self, testname, hz):
        self.results[testname] = hz

    def getResult(self, testname):
        return self.results.get(testname, None)

def readResults(dataset, filename):
    allResults = []
    currentResults = None
    with open(filename) as f:
        for line in csv.reader(f, dialect):
            if len(line) == 0:
                currentResults = None
            elif len(line) == 1:
                currentResults = NaclResults(dataset, line[0])
                allResults.append(currentResults)
            elif len(line) == 3:
                # Column names or result data
                if line[0] == 'Test':
                    pass
                else:
                    currentResults.setResult(line[0], float(line[1]))
            else:
                print 'Ignored input line:', line
    return allResults

def select(db, datasetpattern = None, enginepattern = None):
    results = []
    for r in db:
        if datasetpattern is None or r.dataset == datasetpattern:
            if enginepattern is None or r.engine == enginepattern:
                results.append(r)
    return results

testmap = [
    ["hashops",
     "Hash operations (per sec)",
     [["nacl.crypto_hash_string", "nacl.crypto_hash_string(\"hello\")"],
      ["nacl.crypto_hash", "nacl.crypto_hash(hello)"]]],
    ["curveops",
     "Shared-key computations (per sec)",
     [["nacl.crypto_box_keypair_from_seed", "nacl.crypto_box_keypair_from_seed(hello)"],
      ["nacl.crypto_box_precompute", "nacl.crypto_box_precompute(kp.boxPk, kp.boxSk)"],
      ["nacl.crypto_box", "nacl.crypto_box(hello, n, kp.boxPk, kp.boxSk)"],
      ["nacl.crypto_box_open", "nacl.crypto_box_open(c2, n, kp.boxPk, kp.boxSk)"]]],
    ["noncegen",
     "Random nonce generation (per sec)",
     [["nacl.crypto_box_random_nonce", "nacl.crypto_box_random_nonce()"]]],
    ["secretops",
     "Secret-key operations (per sec)",
     [["nacl.crypto_box_precomputed", "nacl.crypto_box_precomputed(hello, n, selfShared)"],
      ["nacl.crypto_box_open_precomputed", "nacl.crypto_box_open_precomputed(c, n, selfShared)"]]],
    ["signops",
     "Signature operations (per sec)",
     [["nacl.crypto_sign", "nacl.crypto_sign(m, skp.signSk)"],
      ["nacl.crypto_sign_open", "nacl.crypto_sign_open(signed, skp.signPk)"]]],
    ]

def compute_friendly_names():
    result = []
    for (cat, label, vals) in testmap: result.extend(vals)
    return result

friendly_name_mapping = compute_friendly_names()
friendly_names = [f for (f, u) in friendly_name_mapping]

dataset_name_mapping = [
    ['Jan 2013', 'old'],
    ['Aug 2013', 'new'],
    ]

db = \
    readResults('old', 'emscripten-20130116-4e09482e.csv') + \
    readResults('new', 'emscripten-20130808-b1eaf55e-O2.csv')

def compute_engines():
    result = set()
    for r in db: result.add((r.engine, r.version))
    return sorted(result)

engines = compute_engines()
engine_names = [e for (e, v) in engines]

print engines

def speedups():
    by_engine = {}
    for engine in engine_names:
        ratios = {}
        (old,) = select(db, 'old', engine)
        (new,) = select(db, 'new', engine)
        for (friendly, unfriendly) in friendly_name_mapping:
            oldval = old.getResult(unfriendly)
            newval = new.getResult(unfriendly)
            if oldval is None or newval is None:
                ratios[friendly] = ''
            else:
                ratio = newval / oldval
                ratios[friendly] = ratio
        by_engine[engine] = ratios

    for (cat, label, tests) in testmap:
        with open('RESULT-speedups-%s.csv' % (cat,), 'w') as f:
            writer = csv.writer(f)
            # writer.writerow(['Operation', '(previous)'] + engine_names)
            # for (friendly, unfriendly) in friendly_name_mapping:
            #     writer.writerow([friendly, 1.0] + [by_engine[e][friendly] for e in engine_names])
            fns = [f for (f,u) in tests]
            writer.writerow([label])
            writer.writerow(['Engine'] + fns)
            for e in engine_names:
                writer.writerow([e] + [by_engine[e][f] for f in fns])
    return by_engine

def absolutes():
    by_engine = {}
    for engine in engine_names:
        values = {}
        (new,) = select(db, 'new', engine)
        for (friendly, unfriendly) in friendly_name_mapping:
            newval = new.getResult(unfriendly)
            if newval is None:
                values[friendly] = ''
            else:
                values[friendly] = newval
        by_engine[engine] = values

    for (cat, label, tests) in testmap:
        with open('RESULT-hz-%s.csv' % (cat,), 'w') as f:
            writer = csv.writer(f)
            fns = [f for (f,u) in tests]
            writer.writerow([label])
            writer.writerow(['Engine'] + fns)
            for e in engine_names:
                writer.writerow([e] + [by_engine[e][f] for f in fns])

def snippets(speedups_table):
    with open('snippets.md', 'w') as outfile:
        for (cat, label, tests) in testmap:
            ratios = []
            for e in engine_names:
                prod = 1.0
                count = 1
                for (f, u) in tests:
                    if speedups_table[e][f]:
                        prod = prod * speedups_table[e][f]
                        count = count + 1
                geomean = math.pow(prod, 1.0 / count)
                ratios.append(e + ' = ' + ('%.2g' % geomean) + '×')
            ratios = '; '.join(ratios)
            outfile.write('''
<img src="<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/hz-%(cat)s-640.png" alt="%(label)s">

(Approximate speedups since January: %(ratios)s. [Chart](<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/speedups-%(cat)s-640.png).)
''' % {"cat": cat, "label": label, "ratios": ratios})

#             f.write('''
# <table>
# <tr>
# <td><a href="<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/hz-%(cat)s-640.png"><img src="<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/hz-%(cat)s-319.png" alt="%(label)s"></a></td>
# <td><a href="<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/speedups-%(cat)s-640.png"><img src="<?config.image_url?>/tech/benchmarking-nacl-and-scrypt-in-the-browser-201308/speedups-%(cat)s-319.png" alt="Speedup, as ratio since January"></a></td>
# </tr>
# </table>
# ''' % {"cat": cat, "label": label})

speedups_table = speedups()
absolutes()
snippets(speedups_table)
