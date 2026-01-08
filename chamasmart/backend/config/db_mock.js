console.log('DB_DEBUG: Init');
const mockPool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: (cb) => { if (cb) cb(null, {}, () => { }); },
    on: () => { }
};
console.log('DB_DEBUG: mock created');
module.exports = mockPool;
