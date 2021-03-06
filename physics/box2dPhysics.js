/*jshint camelcase:false, indent:2, quotmark:true, nomen:false, onevar:false, passfail:false */
'use strict';

var Box2D = require('box2dweb-commonjs').Box2D;

var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2World = Box2D.Dynamics.b2World;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;


var bodyDef = new b2BodyDef;
var PADDLE_WALL_DISTANCE = 0.2;

/**
 * NON-IE
 * @param array1 array 1
 * @param array2 array 2
 * @return {boolean} if array1 contains all members of array2
 */
function containsAll(array1, array2) {
  return array1.every(function (v) {
    return array2.indexOf(v) !== -1;
  });
}

/**
 * Initialize physics environment
 * @param width field width
 * @param height field height
 * @param ballRadius ball game radius
 * @constructor
 */
function Physics(width, height, ballRadius) {
  this._height = height;
  this._width = width;
  this._ballRadius = ballRadius || 0.2;
  this._world = null;
  this._ballScored = function () {
  };
  this._paddleFixtures = {};
  this._init();
}

module.exports = Physics;

/**
 * player types enum
 * @type {{LEFT: string, RIGHT: string}}
 */
Physics.prototype.playerType = {
  LEFT : 'left',
  RIGHT : 'right'
};


/**
 * add paddle to game
 * @param playerType [Physics.prototype.playerType] type
 * @param size [{width, height}] paddle dimensions
 */
Physics.prototype.addPaddle = function (playerType, size) {
  var fixDef = new b2FixtureDef;
  fixDef.density = 5.0;
  fixDef.friction = 1;
  fixDef.restitution = 1.0;
  bodyDef.type = b2Body.b2_dynamicBody;
  bodyDef.position.Set(0, this._height / 2);
  fixDef.shape = new b2PolygonShape;
  fixDef.shape.SetAsBox(size.width / 2, size.height / 2);
  var paddle = this._world.CreateBody(bodyDef).CreateFixture(fixDef);
  paddle._size = size;
  this._paddleFixtures[playerType] = paddle;

  if (playerType === this.playerType.LEFT) {
    this._jointPaddleToWall(paddle, this._leftWall, -PADDLE_WALL_DISTANCE);
  } else {
    this._jointPaddleToWall(paddle, this._rightWall, PADDLE_WALL_DISTANCE);
  }
};

/**
 * remove paddle from field
 * @param playerType left/right
 */
Physics.prototype.removePaddle = function (playerType) {
  this._world.DestroyBody(this._paddleFixtures[playerType].GetBody());
  delete this._paddleFixtures[playerType];
};

Physics.prototype._jointPaddleToWall = function (paddleFixture, wallFixture, distanceFromWall) {
  var jointDef = new Box2D.Dynamics.Joints.b2PrismaticJointDef();
  jointDef.bodyA = paddleFixture.GetBody();
  jointDef.bodyB = wallFixture.GetBody();
  jointDef.collideConnected = false;
  jointDef.localAxisA.Set(0.0, 1.0);
  jointDef.localAnchorA.Set(distanceFromWall, 0);
  jointDef.enableMotor = true;
  jointDef.maxMotorForce = 2;
  this._world.CreateJoint(jointDef);
};

/**
 * Change position and speed of the ball
 * @param position [{x, y}]
 * @param speed [Box2D.Common.Math.b2Vec2]
 */
Physics.prototype.positionBall = function (position, speed) {
  this._ball.GetBody().SetPosition(position);
  this._ball.GetBody().SetLinearVelocity(speed);

};

/**
 * iteration of physics iteration
 * @param period [Number] in seconds
 * @param accuracy [Number] accuracy of collisions and speeds
 */
Physics.prototype.tick = function (period, accuracy) {
  this._world.Step(
    period   //frame-rate
    , accuracy       //velocity iterations
    , accuracy       //position iterations
  );
  this._world.ClearForces();
};

/**
 * Get positions of game objects
 * @return {{ball: {x, y}, paddles: Array}}
 */
Physics.prototype.getBallAndPaddlePositions = function () {
  var that = this;
  var paddles = Object.keys(this._paddleFixtures).map(function (key) {
    return that._paddleFixtures[key].GetBody().GetPosition();
  });
  return {
    ball : this._ball.GetBody().GetPosition(),
    paddles : paddles
  };
};

/**
 * push paddle
 * @param playerType [Physics.prototype.playerType]
 * @param direction [Box2D.Common.Math.b2Vec2]
 */
Physics.prototype.giveImpulseToPaddle = function (playerType, direction) {
  var paddleBody = this._paddleFixtures[playerType].GetBody();
  paddleBody.ApplyForce(direction, paddleBody.GetWorldCenter());
};

/**
 * Register callback for ball scored event
 * @param callback [function (Physics.prototype.playerType)]
 */
Physics.prototype.onBallScored = function (callback) {
  this._ballScored = callback;
};

Physics.prototype._init = function () {
  var fixDef = new b2FixtureDef;
  fixDef.density = 1.0;
  fixDef.friction = 1;
  fixDef.restitution = 1.0;

  var that = this;
  this._world = new b2World(
    new b2Vec2(0, 0)    //gravity
    , true                 //allow sleep
  );

  bodyDef.type = b2Body.b2_dynamicBody;
  fixDef.shape = new b2CircleShape(
    that._ballRadius
  );
  bodyDef.position.Set(this._width / 2, this._height / 2);
  this._ball = this._world.CreateBody(bodyDef).CreateFixture(fixDef);

  // ground
  bodyDef.type = b2Body.b2_staticBody;
  bodyDef.position.Set(0, this._height);
  fixDef.shape = new b2PolygonShape;
  fixDef.shape.SetAsEdge(new b2Vec2(0, 0), new b2Vec2(this._width, 0));

  this._floor = this._world.CreateBody(bodyDef).CreateFixture(fixDef);

  // ceiling
  bodyDef.position.Set(0, 0);
  this._ceiling = this._world.CreateBody(bodyDef).CreateFixture(fixDef);

  // left wall
  bodyDef.position.Set(0, 0);
  fixDef.shape = new b2PolygonShape;
  fixDef.shape.SetAsEdge(new b2Vec2(0, 0), new b2Vec2(0, this._height));
  this._leftWall = this._world.CreateBody(bodyDef).CreateFixture(fixDef);

  // right wall
  bodyDef.position.Set(this._width, 0);
  fixDef.shape.SetAsEdge(new b2Vec2(0, 0), new b2Vec2(0, this._height));
  this._rightWall = this._world.CreateBody(bodyDef).CreateFixture(fixDef);

  // important callbacks
  var contactListener = new Box2D.Dynamics.b2ContactListener();
  contactListener.BeginContact = function (contact) {
    var fixA = contact.GetFixtureA();
    var fixB = contact.GetFixtureB();
    // ball score callback
    if (containsAll([fixA, fixB], [that._leftWall, that._ball])) {
      that._ballScored(that.playerType.RIGHT);
    }
    if (containsAll([fixA, fixB], [that._rightWall, that._ball])) {
      that._ballScored(that.playerType.LEFT);
    }
  };
  this._world.SetContactListener(contactListener);
};

