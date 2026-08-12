#!/usr/bin/env node

const { command, flag, description } = require('paparam')
const { HyperTracker } = require('hypertracker')
const Instrumentation = require('hyper-instrument')
const goodbye = require('graceful-goodbye')
const IdEnc = require('hypercore-id-encoding')
const HyperDHT = require('hyperdht')
const pino = require('pino')
const b4a = require('b4a')

const { version: ownVersion } = require('./package.json')

const DEFAULT_STORAGE = './hypertracker-storage'

const run = command(
  'run',
  description('Run a hypertracker service'),
  flag('--storage|-s [path]', `Storage path, defaults to ${DEFAULT_STORAGE}`),
  flag(
    '--scraper-public-key [scraper-public-key]',
    'Public key of a hyperdht-prometheus-bridge scraper. Can be hex or z32.'
  ),
  flag(
    '--scraper-secret [scraper-secret]',
    'Secret of the hyperdht-prometheus-bridge scraper. Can be hex or z32.'
  ),
  flag('--scraper-alias [scraper-alias]', '(optional) Alias with which to register to the scraper'),
  flag('--bootstrap [bootstrap]', 'Bootstrap nodes for the DHT'),

  async function ({ flags }) {
    const logger = pino({ name: 'hypertracker' })
    const storage = flags.storage || DEFAULT_STORAGE
    const bootstrap = flags.bootstrap ? JSON.parse(flags.bootstrap) : undefined
    logger.info(`Starting tracker service with storage: ${storage}`)

    const dht = new HyperDHT({ bootstrap })
    const tracker = new HyperTracker(storage, { dht })
    await tracker.ready()
    logger.info(`Hypertracker public key: ${b4a.toString(tracker.publicKey, 'hex')}`)
    logger.info(`Hypertracker public key (z32): ${IdEnc.normalize(tracker.publicKey)}`)

    let instrumentation = null
    goodbye(async () => {
      if (instrumentation) {
        logger.info('Closing instrumentation...')
        await instrumentation.close()
      }
      logger.info('Shutting down tracker service...')
      await tracker.close()
      await dht.destroy()
      logger.info('Shut down')
    })

    if (flags.scraperPublicKey && flags.scraperSecret) {
      logger.info('Setting up instrumentation')

      const scraperPublicKey = IdEnc.decode(flags.scraperPublicKey)
      const scraperSecret = IdEnc.decode(flags.scraperSecret)

      let prometheusAlias = flags.scraperAlias
      if (prometheusAlias && prometheusAlias.length > 99) {
        throw new Error('The Prometheus alias must have length less than 100')
      }
      if (!prometheusAlias) {
        prometheusAlias = `hypertracker-${IdEnc.normalize(tracker.publicKey)}`
      }

      instrumentation = new Instrumentation({
        dht: tracker.dht,
        scraperPublicKey,
        prometheusAlias,
        scraperSecret,
        prometheusServiceName: 'hypertracker',
        version: ownVersion
      })

      tracker.registerMetrics(instrumentation.promClient)

      instrumentation.registerLogger(logger)
      await instrumentation.ready()
    }
  }
)

const cmd = command('hypertracker', run)

cmd.parse()
