## Express middleware for basic authentication

### Prerequisites

- [express](https://expressjs.com) based webserver
- mysql ([knex](https://knexjs.org) compatible) database (see @pubcore/knex-auth)

### Features

- supports two type of users: SYSTEM and HUMAN
- will set an user object to express req object (if authentication succeeded)
- serves allways "401 Unauthorized" and cancel URI, if no credentials
- serves allways "401 Unautherized" and cancel URI, if user not found
- calls express "next", if username and password is ok
- redirect to "deactivated" page, if wrong password used too much within a time window (105ms)
- redirect to "deactivated" page, if last login of user is long time ago
- updates last login stamp, one time within defined time frame
- redirects to change password page (including a back-uri), on first request of new user
- redirects to change password page (including a back-uri), if password is expired
- support secondary password for SYSTEM users
- does set a flag to user object (oldPwUsed), if secondary password exists, but old password has been used
- optinal support of login by JsonWebToken cookie (Jwt), enabled if option "jwtKeyFile" is available

[activity diagram](doc/authentication-flow.pdf)

### Configuration options (set on server startup)

    	options = {
    		publicCancelLoginUri:'/login/canceled',
    		publicDeactivatedUri:'/login/deactivated',
    		changePasswordUri:'/login/pwchange',
    		maxTimeWithoutActivity: 1000 * 60 * 60 * 24 * 180,//[msec]
    		maxLoginAttempts:10,
    		maxLoginAttemptsTimeWindow:1000 * 3600 * 24,//[msec]
    		minTimeBetweenUpdates:1000 * 3600,//[msec],
    		jwtKeyFile:'/run/secret/jwt-key.txt' //optional
    	},
    	table = 'user',

### Example

    	const
    		createLoginMiddleware = require('@pubcore/express-basic-auth').default,
    		options = {
    			changePasswordUri:'/login/pwchange',
    			publicDeactivatedUri:'/login/deactivated',
    			publicCancelLoginUri:'/login/canceled',
    			maxTimeWithoutActivity: 1000 * 60 * 60 * 24 * 180,//[msec]
    			maxLoginAttempts:10,
    			maxLoginAttemptsTimeWindow:1000 * 3600 * 24,//[msec]
    			minTimeBetweenUpdates:1000 * 3600,//[msec]
    		},
    		table = 'user',
    		knex = new Knex({
    			client: 'mysql', connection: {/* see knex*/}
    		}),
    		db = {knex, table}

    	const login = createLoginMiddleware({db, options})
    	const router = express.Router()
    	router.all('/', login)
