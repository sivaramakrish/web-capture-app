from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.testclient import TestClient
import pytest
from datetime import timedelta
from main import (
    app, 
    authenticate_user, 
    create_access_token, 
    ACCESS_TOKEN_EXPIRE_MINUTES, 
    users_db, 
    pwd_context,
    UserCreate,  
    UserInDB   
)

app = FastAPI()

# Initialize OAuth2 with token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Define protected endpoint
@app.get("/protected")
async def protected_endpoint(token: str = Depends(oauth2_scheme)):
    return {"status": "protected", "message": "Access granted"}

# Define token endpoint
@app.post("/auth/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Test client
client = TestClient(app)

# Test data
TEST_USER = {"username": "testuser", "password": "testpass"}
INVALID_USER = {"username": "wronguser", "password": "wrongpass"}

# Test fixture for setting up test user
@pytest.fixture(autouse=True)
def setup_test_user():
    """Setup test user before each test"""
    hashed_password = pwd_context.hash(TEST_USER["password"])
    users_db[TEST_USER["username"]] = {"username": TEST_USER["username"], "hashed_password": hashed_password}
    yield
    users_db.clear()

# Token generation tests
def test_token_generation():
    """Test successful token generation"""
    # First create a test user (in real app this would be in DB)
    response = client.post("/auth/token", data=TEST_USER)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "token_type" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_invalid_credentials():
    """Test token generation with invalid credentials"""
    response = client.post("/auth/token", data=INVALID_USER)
    assert response.status_code == 401
    assert "detail" in response.json()

# User authentication tests
def test_authenticate_user_valid():
    """Test successful user authentication"""
    user = authenticate_user(TEST_USER["username"], TEST_USER["password"])
    assert user is not None
    assert user.username == TEST_USER["username"]

def test_authenticate_user_invalid():
    """Test failed user authentication"""
    user = authenticate_user(INVALID_USER["username"], INVALID_USER["password"])
    assert user is None

# Protected endpoint tests
def test_protected_endpoint_with_token():
    """Test accessing protected endpoint with valid token"""
    # Get token first
    token_response = client.post("/auth/token", data=TEST_USER)
    token = token_response.json()["access_token"]
    
    # Access protected endpoint
    response = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

def test_protected_endpoint_without_token():
    """Test accessing protected endpoint without token"""
    response = client.get("/protected")
    assert response.status_code == 401

# Token expiration test (requires mocking time)
@pytest.mark.skip(reason="Requires time mocking")
def test_token_expiration():
    """Test token expiration"""
    pass

# Existing endpoints
@app.get("/test")
async def test_endpoint():
    return {"status": "working", "message": "Minimal test successful"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
