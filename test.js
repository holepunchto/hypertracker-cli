const test = require('brittle')
const { spawn } = require('child_process')
const path = require('path')
const process = require('process')
const crypto = require('hypercore-crypto')
const IdEnc = require('hypercore-id-encoding')
const HyperDHT = require('hyperdht')
const createTestnet = require('hyperdht/testnet')
const NewlineDecoder = require('newline-decoder')
const { isBare } = require('which-runtime')
const { HyperTrackerClient } = require('hypertracker')

const DEBUG = false
const EXECUTABLE = path.join(__dirname, isBare ? 'bin-bare.js' : 'bin.js')
const PUBLIC_KEY_MARKER = 'Hypertracker public key (z32): '

test('bin', async (t) => {
  const testnet = await createTestnet()
  t.teardown(() => testnet.destroy(), { order: 5000 })

  const storage = await t.tmp()

  const proc = spawn(process.execPath, [
    EXECUTABLE,
    'run',
    '--storage',
    storage,
    '--bootstrap',
    JSON.stringify(testnet.bootstrap)
  ])

  process.on('exit', () => proc.kill('SIGKILL'))
  t.teardown(() => proc.kill('SIGKILL'), { order: 4000 })

  proc.stderr.on('data', (d) => {
    if (DEBUG) console.log(d.toString())
    t.fail('There should be no stderr: ' + d.toString())
  })

  const started = t.test('service logs its public key')
  started.plan(1)

  let publicKey = null
  const stdoutDec = new NewlineDecoder('utf-8')
  proc.stdout.on('data', (d) => {
    if (DEBUG) console.log(d.toString())

    for (const line of stdoutDec.push(d)) {
      if (!line) continue

      let msg
      try {
        msg = JSON.parse(line).msg
      } catch {
        continue
      }

      if (typeof msg === 'string' && msg.includes(PUBLIC_KEY_MARKER)) {
        publicKey = msg.split(PUBLIC_KEY_MARKER)[1].trim()
        started.pass('public key logged')
      }
    }
  })

  await started

  const subscriberDht = new HyperDHT({ bootstrap: testnet.bootstrap })
  t.teardown(() => subscriberDht.destroy(), { order: 4000 })
  const announcerDht = new HyperDHT({ bootstrap: testnet.bootstrap })
  t.teardown(() => announcerDht.destroy(), { order: 4000 })

  const subscriber = new HyperTrackerClient(IdEnc.decode(publicKey), { dht: subscriberDht })
  t.teardown(() => subscriber.close(), { order: 3000 })
  await connect(subscriber)

  const keyPair = crypto.keyPair()
  subscriber.on('announce', (ann) => {
    announced.alike(ann.publicKey, keyPair.publicKey, 'announced public key matches')
  })
  subscriber.subscribe(keyPair.publicKey)

  const announcer = new HyperTrackerClient(IdEnc.decode(publicKey), { dht: announcerDht })
  t.teardown(() => announcer.close(), { order: 3000 })
  await connect(announcer)

  const announced = t.test('announce event received')
  announced.plan(1)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  announcer.announce(keyPair)
  await announced
})

function connect(client) {
  client.connect()
  return new Promise((resolve) => client.once('connect', resolve))
}
