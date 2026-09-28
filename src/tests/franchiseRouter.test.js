const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');
const { Role } = require('../model/model.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  user.password = 'toomanysecrets';

  return user;
}

let testAdminUser;
let testAdminUserToken;

beforeAll(async () => {
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminUserToken = loginRes.body.token;
});

test('create a franchise', createFranchise);

async function createFranchise() {
    const franchiseName = `testFranchise-${randomName()}`;
    const franchiseCreationReqBody = { name: franchiseName, admins: [{ email: testAdminUser.email }] };
    const franchiseCreationRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(franchiseCreationReqBody);
    expect(franchiseCreationRes.status).toBe(200);
    expect(franchiseCreationRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(franchiseCreationRes.body).toMatchObject({
            name: franchiseName,
            admins: [{ 
                email: testAdminUser.email, 
                id: testAdminUser.id,
                name: testAdminUser.name 
            }], 
            id: expect.any(Number)
    });
    return franchiseCreationRes.body;
}

test('get franchises', async() => {
    const getFranchisesRes = await request(app)
        .get('/api/franchise');
    expect(getFranchisesRes.status).toBe(200);
    expect(getFranchisesRes.headers['content-type']).toMatch('application/json; charset=utf-8');
});

test('get specific franchise', async() => {
    const franchise = await createFranchise();
    const getSpecificFranchiseRes = await request(app)
        .get(`/api/franchise?name=${franchise.name}`);
    expect(getSpecificFranchiseRes.status).toBe(200);
    expect(getSpecificFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(getSpecificFranchiseRes.body).toMatchObject({
        franchises: [{
            id: franchise.id,
            name: franchise.name,
            stores: [],
        }],
        more: false
    });
});

test('get user franchises', async () => {
    const franchise = await createFranchise();
    const getUserFranchisesRes = await request(app)
        .get(`/api/franchise/${testAdminUser.id}`)
        .set('Authorization', `Bearer ${testAdminUserToken}`);
    expect(getUserFranchisesRes.status).toBe(200);
    expect(getUserFranchisesRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(getUserFranchisesRes.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
            id: franchise.id,
            name: franchise.name,
            admins: [{
                id: testAdminUser.id,
                name: testAdminUser.name,
                email: testAdminUser.email
            }],
            stores: []
        })
    ]));
});

test('create a store', createStore);

async function createStore() {
    const franchise = await createFranchise();
    const franchiseID = franchise.id;
    const storeName = `testStore-${randomName()}`;
    const createStoreReqBody = { franchiseID: franchiseID, name: storeName, }; 
    const createStoreRes = await request(app)
        .post(`/api/franchise/${franchiseID}/store`)
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(createStoreReqBody);
    expect(createStoreRes.status).toBe(200);
    expect(createStoreRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(createStoreRes.body).toMatchObject({
        id: expect.any(Number),
        franchiseId: franchiseID,
        name: storeName
    });
    return [createStoreRes.body.id, createStoreRes.body.franchiseId];
}

test('delete a franchise', deleteFranchise);

async function deleteFranchise() {
    const franchise = await createFranchise();
    const franchiseID = franchise.id;
    const deleteFranchiseRes = await request(app)
        .delete(`/api/franchise/${franchiseID}`)
        .set('Authorization', `Bearer ${testAdminUserToken}`);
    expect(deleteFranchiseRes.status).toBe(200);
    expect(deleteFranchiseRes.header['content-type']).toMatch('application/json; charset=utf-8');
    expect(deleteFranchiseRes.body).toMatchObject({
        message: 'franchise deleted'
    });
}

test('delete a store', deleteStore);

async function deleteStore() {
    const idList = await createStore();
    const deleteStoreRes = await request(app)
        .delete(`/api/franchise/${idList[0]}/store/${idList[1]}`)
        .set('Authorization', `Bearer ${testAdminUserToken}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(deleteStoreRes.body).toMatchObject({
        message: 'store deleted'
    });
}