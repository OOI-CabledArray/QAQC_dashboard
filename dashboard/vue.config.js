const crypto = require('crypto');

module.exports = {
  configureWebpack: () => {
    // Workaround for loaders using "md4" by default,
    // which is not supported in FIPS-compliant OpenSSL
    // See https://github.com/jupyterlab/jupyterlab/issues/11248
    const cryptoOrigCreateHash = crypto.createHash;
    crypto.createHash = (algorithm) => cryptoOrigCreateHash(algorithm === 'md4' ? 'sha256' : algorithm); // eslint-disable-line no-eval
  },
  configureWebpack: {
    devtool: 'source-map'
  }
};
