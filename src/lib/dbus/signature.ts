const match = {
  '{': '}',
  '(': ')',
}

const knownTypes: { [key: string]: boolean } = {}

'(){}ybnqiuxtdsogarvehm*?@&^'.split('').forEach((c) => {
  knownTypes[c] = true
})

function checkNotEnd(c: any) {
  if (!c) {
    throw new Error('Bad signature: unexpected end')
  }
  return c
}

export default function (signature: any): any {
  let index = 0

  function next() {
    if (index < signature.length) {
      const c = signature[index]
      ++index
      return c
    }
    return null
  }

  function parseOne(c: string) {
    if (!knownTypes[c]) {
      throw new Error(`Unknown type: "${c}" in signature "${signature}"`)
    }

    let ele
    const res: any = { type: c, child: [] }
    switch (c) {
      case 'a': // array
        ele = next()
        checkNotEnd(ele)
        res.child.push(parseOne(ele))
        return res
      case '{': // dict entry
      case '(': // struct
        ele = next()
        do {
          if (ele !== null && ele !== match[c]) {
            res.child.push(parseOne(ele))
          }
          ele = next()
        } while (ele !== null && ele !== match[c])
        checkNotEnd(ele)
        return res
    }
    return res
  }

  const ret = []
  let c = next()
  while (c !== null) {
    ret.push(parseOne(c))
    c = next()
  }
}
