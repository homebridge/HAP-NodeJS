# coding=utf-8
x = u"dsf;ijef щлоауцжадо 日本語"
print repr(x.encode('utf-8'))
print len(x.encode('utf-8'))
print x.encode('utf-8').encode('hex')
print x.encode('utf-8').encode('hex').decode('hex').decode('utf-8')

codes = [100, 115, 102, 59, 105, 106, 101, 102, 32, 1097, 1083, 1086, 1072, 1091, 1094, 1078, 1072, 1076, 1086, 32, 26085, 26412, 35486]
x2 = u''.join((unichr(c) for c in codes))
print x2
print x2.encode('utf-8').encode('hex')

# x3 = unichr(119070) can't do this with a "narrow python build" ffs
x3 = u'\U0001d11e'
print x3
print x3.encode('utf-8').encode('hex')
# 240 157 132 158

# bogus encoding
x4 = ''.join([chr(c) for c in [237, 160, 180, 237, 180, 158]])
print x4.encode('hex')
print x4.decode('utf-8')
print x4.decode('utf-8').encode('utf-8').encode('hex')
