const crypto = require('crypto');

module.exports = {
  configureWebpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      // mutate config for production...
    } else {
      // Workaround for loaders using "md4" by default, which is not supported in FIPS-compliant OpenSSL
      // See https://github.com/jupyterlab/jupyterlab/issues/11248
      const cryptoOrigCreateHash = crypto.createHash;
      crypto.createHash = (algorithm) => cryptoOrigCreateHash(algorithm === 'md4' ? 'sha256' : algorithm);
    }
  },
};
