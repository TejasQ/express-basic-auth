'use strict'

const chai = require('chai'),
	{expect} = chai,
	login = require('../js/index').default,
	chaiHttp = require('chai-http'),
	express = require('express'),
	{dbTypes} = require('@pubcore/knex-auth'),
	createTestDb = require('@pubcore/knex-create-test-db'),
	defaultMap = require('./userDefaultMap').default,
	{resolve} = require('path'),
	cookie = require('cookie'),
	JWT = require('jsonwebtoken')

chai.use(chaiHttp)
const app = express(),
	app2 = express(),
	options = {
		publicDeactivatedUri:'/login/deactivated',
		changePasswordUri:'/login/pwchange',
		publicCancelLoginUri:'/login/canceled',
		maxTimeWithoutActivity: 1000 * 60 * 60 * 24 * 180,//[msec]
		maxLoginAttempts:2,
		maxLoginAttemptsTimeWindow:50,//[msec]
		minTimeBetweenUpdates:500,//[msec]
	},
	table = 'user',
	knex = createTestDb({table, rows:defaultMap([{}, {
		username:'adam', password:null, last_login:null,
		password_new:'tempPw', created_time:new Date(),
		password_expiry_date:new Date()
	}, {
		username:'bob', last_login:new Date('2000-01-01T00:00:00')
	}, {
		username:'tom', password_secondary:'new'
	}, {
		username:'ben', password_expiry_date:new Date()
	}]), beforeEach, after, dbTypes:{
		...dbTypes, first_name:'string', last_name:'string', email:'string'
	}}),
	db = {knex, table},
	error = err => {throw err},
	Jwt = JWT.sign({ username: 'eve' }, 'somestring')

app.use(login({db, options}))
app.use('/', (req, res) => res.send(req.user))

//JWT support for app2
app2.use((req, res, next) => {
	req.cookies = cookie.parse(req.headers.cookie || '')
	next()
})
app2.use(login({db, options:{...options, jwtKeyFile:resolve(__dirname, 'jwtKey.txt')}}))
app2.use('/', (req, res) => res.send(req.user))

const lastMediaType = 0
const aMediaType = () => {
	return (['text/html', 'application/json', 'application/xml'])[++lastMediaType%3]
}
const repead = (n, p) => {
	return Promise.all((new Array(n)).map(() => p))
}
const expect401 = res => {
	expect(res).to.have.status(401)
	expect(res.text).to.contain(options.publicCancelLoginUri)
}
const expect200 = res => expect(res).to.have.status(200)
const wait = ms => new Promise(res => setTimeout(()=>res(), ms))
const wrongPasswordRequest = () =>
	chai.request(app).get('/').set('Accept', aMediaType()).redirects(0).auth('eve', 'xyz')
const correctPasswordRequest = (username='eve') =>
	chai.request(app).get('/').redirects(0).auth(username, 'test')

describe('http authentication service', () => {
	it('exports API', () => expect(login).not.to.be.undefined)
	it('serves allways "401 Unauthorized" and cancel URI, if no credentials',
		() => repead(3, chai.request(app).get('/').then(expect401))
	)
	it('serves allways "401 Unautherized" and cancel URI, if user not found',
		() => repead(3, chai.request(app).get('/').auth('xyz', 'test').then(expect401))
	)
	it('serves "200 ok" if username and password is ok',
		() => correctPasswordRequest().then(expect200, error)
	)
	it('redirect to "deactivated" page, if wrong password used too much within a time window',
		() => wrongPasswordRequest().then(expect401)
			//after a correct request counter is reset
			.then(() => correctPasswordRequest().then(expect200))
			.then(() => wrongPasswordRequest().then(expect401))
			//wait to get outsite of time window
			.then(() => wait(options.maxLoginAttemptsTimeWindow))
			.then(() => wrongPasswordRequest().then(expect401))
			.then(() => wrongPasswordRequest().then(
				res => expect(res).redirectTo(options.publicDeactivatedUri)
			))
			//now, even a request with correct password must lead to deactivated
			.then(() => correctPasswordRequest().then(
				res => expect(res).redirectTo(options.publicDeactivatedUri)
			))
	)
	it('redirect to "deactivated" page, if last login of user is long time ago',
		() => chai.request(app).get('/').redirects(0).auth('bob', 'test')
			.then(res => expect(res).redirectTo(options.publicDeactivatedUri))
	)
	it('updates last login stamp, one time within defined time frame', () => {
		const firstStamp
		return correctPasswordRequest().then(({body}) => {
			firstStamp = body.last_login
		}, error)
			.then(() => correctPasswordRequest().then(({body}) => {
				expect(firstStamp).to.equal(body.last_login)
			}, error))
			.then(() => wait(options.minTimeBetweenUpdates))
			.then(() => correctPasswordRequest())
			.then(() => correctPasswordRequest().then(({body}) => {
				expect(firstStamp).to.not.equal(body.last_login)
			}, error))
	})
	it('redirects to change password page (including a back-uri), on first request of new user', () => {
		const uri = '/xyz/?foo=bar'
		return chai.request(app).get(uri).redirects(0).auth('adam', 'tempPw').then(
			res => expect(res)
				.redirectTo(options.changePasswordUri)
				.and.to.have.cookie('back-uri', encodeURIComponent(uri))
		)
	})
	it('redirects to change password page (including a back-uri), if password is expired', () => {
		const uri = '/foo/?bar=xyz'
		return chai.request(app).get(uri).redirects(0).auth('ben', 'test').then(
			res => expect(res)
				.redirectTo(options.changePasswordUri)
				.and.to.have.cookie('back-uri', encodeURIComponent(uri))
		)
	})
	it('does set a flag (oldPwUsed), if secondary password exists, but old password has been used', () =>
		correctPasswordRequest('tom').then(({body}) => expect(body.oldPwUsed).to.be.true)
	)
	it('does not add any password fields', () =>
		correctPasswordRequest('tom').then(({body}) =>
			expect(JSON.stringify(body)).to.not.contain('password')
		)
	)
	it('serves basic user data', () =>
		correctPasswordRequest('tom').then(({body}) =>
			expect(JSON.stringify(body)).to.contain('first_name')
				.and.contain('last_name').and.contain('email')
		)
	)
	it('supports (optional) login by Json Web Token (JWT); depends on jwtKeyFile option exists (staticly cached)', () =>
		chai.request(app2).get('/').set('Cookie', cookie.serialize('Jwt', Jwt)).redirects(0).then(
			expect200, error
		)
	)
	it('rejects with 401 Unautherized, if JWT is invalid', () =>
		chai.request(app2).get('/').set('Cookie', cookie.serialize('Jwt', Jwt+'garbleIt')).redirects(0).then(
			expect401, error
		)
	)
})
