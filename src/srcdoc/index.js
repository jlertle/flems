import inspect from 'object-inspect'
import 'mithril/promise/promise'
import { isScript, isHtml, isCss } from '../utils'

let id = window.name
let currentScript

const parent = window.parent

delete window.parent

Error.stackTraceLimit = Infinity

const monkeys = ['log', 'error', 'warn', 'info', 'time', 'timeEnd']
    , log = window.console.log

monkeys.forEach(monkey => {
  const original = window.console[monkey]

  window.console[monkey] = patch(original, monkey)
})

window.p = patch(null, 'print')

window.onerror = function(msg, file, line, col, err) { // eslint-disable-line
  err.currentScript = currentScript
  consoleOutput(String(err), 'error', err || {
    message: msg,
    stack: (file || 'unknown') + ':' + line + ':' + col
  })
}

window.addEventListener('resize', () => send('resize'))

window.flemsMessage = data => {
  if (data.name === 'init') {
    init(data.content)
  } else if (data.name === 'css') {
    const style = document.getElementById(data.content.name)
    style
      ? style.textContent = data.content.content
      : location.reload()
  } else if (data.name === 'eval') {
    try {
      consoleOutput(window.eval(data.content) || 'undefined', 'log', { stack: '' }) // eslint-disable-line
    } catch (err) {
      consoleOutput(String(err), 'error', { stack: '' })
    }
  }
}

function send(name, content) {
  parent.flemsMessage({
    data: {
      flems: id,
      name: name,
      content: content
    }
  }, '*')
}

function init(data) {
  id = data.id

  const state = data.state
  const body = state.files.filter(f => isHtml(f.name))[0]

  document.documentElement.innerHTML = body ? body.content : ''

  const scripts = Array
    .prototype
    .slice
    .call(document.getElementsByTagName('script'))

  state.load = state
    .links
    .filter(l => l.type === 'js' && l.content)
    .concat(scripts.filter(s => !s.src).map(s =>
      ({ name: '.html', content: s.textContent, el: s })
    ))
    .concat(
      state.files.filter(f => isScript(f.name))
    )

  state.loadRemote = state
    .links
    .filter(l => l.type === 'js' && !l.content)
    .concat(scripts.filter(s => s.src).map(s =>
      ({ url: s.src, type: 'js', el: s })
    ))

  state
    .links
    .filter(l => l.type === 'css' && !l.content)
    .forEach(loadRemoteStyle)

  state.files
    .filter(f => isCss(f.name))
    .concat(state.links.filter(l => l.type === 'css' && l.content))
    .forEach(loadStyle)

  Promise
    .all(state.loadRemote.map(loadRemoteScript))
    .then(loaded => {
      const errors = loaded.filter(l => l)

      if (errors.length > 0) {
        send('error', {
          message: 'Error loading:\n\t' + errors.join('\n\t')
        })
      } else {
        send('loaded')
        state.load.forEach(flemsLoadScript)
      }
    })
}

function patch(original, monkey) {
  return function() {
    (original || log).apply(console, arguments)
    consoleOutput([].slice.apply(arguments).map(a => inspect(a)).join('\n'), monkey, new Error(), 1)
  }
}

function consoleOutput(content, type, err, slice = 0) {
  const stack = err.stack.split('\n')
    .map(parseStackLine)
    .filter(a => a)
    .slice(slice)

  let cutoff = -1

  stack.forEach((s, i) => {
    if (cutoff === -1 && s.function.indexOf('flemsLoadScript') > -1)
      cutoff = i
  })

  send('console', {
    file: err.currentScript,
    content: content,
    stack: cutoff > -1 ? stack.slice(0, cutoff) : stack,
    type: type,
    date: new Date()
  })
}

const locationRegex = /(.*)[ @(](.*):([\d]*):([\d]*)/i
function parseStackLine(line) {
  const match = line.trim().match(locationRegex)

  return match && {
    function: match[1].replace(/^at ?/, ''),
    file: match[2],
    line: parseInt(match[3], 10),
    column: parseInt(match[4], 10)
  }
}

function loadRemoteStyle(style) {
  document.head.appendChild(create('link', {
    rel: 'stylesheet',
    type: 'text/css',
    href: style.url
  }))
}

function loadStyle(css) {
  document.head.appendChild(create('style', {
    id: css.name,
    textContent: css.content
  }))
}

function loadRemoteScript(script) {
  return new Promise((resolve, reject) => {
    const el = create('script', {
      charset: 'utf-8',
      onload: () => resolve(),
      onerror: err => resolve([script.url, err]),
      async: false,
      src: script.url
    })

    script.el
      ? script.el.parentNode.replaceChild(el, script.el)
      : document.body.appendChild(el)
  })
}

function flemsLoadScript(script) {
  const el = create('script', {
    charset: 'utf-8',
    textContent: script.content + '\n//# sourceURL=' + script.name,
    onerror: err => consoleOutput(String(err), 'error', err)
  })

  currentScript = script
  script.el
    ? script.el.parentNode.replaceChild(el, script.el)
    : document.body.appendChild(el)
}

function create(tag, options) {
  const el = document.createElement(tag)

  for (const key in options)
    el[key] = options[key]

  return el
}