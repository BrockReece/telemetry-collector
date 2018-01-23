var elasticsearch = require('elasticsearch');

const client = new elasticsearch.Client({
    host: process.env.ELASTIC_HOST || '192.168.99.100:9200',
});

module.exports.buildFilters = (query) => {
    return Object.keys(query).map((key) => {
        const name = ['user_id'].indexOf(key) === - 1 ? `${key}.raw` : key

        if (key === 'loadTime') {
            return {
                range: { 
                    startTime: { 
                        lt: req.query[key], 
                    },
                },
            }
        }

        return {
            term: { [name]: query[key], },
        }
    })
}

module.exports.simpleAggregation = (field, filter) => {
    return client.search({
        index: 'telemetry',
        body: {
            size: 0,
            query: {
                bool: {
                    filter,
                },
            },
            aggs: {
                users: {
                    terms: {
                        field,
                        size: 30,
                    },
                }
            }
        },
    })
}

module.exports.client = client