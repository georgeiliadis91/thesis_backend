module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', '2284af82973c48c062dca23d7bf19c8c'),
  },
});
