/*eslint-disable no-shadow, handle-callback-err */

var Job = require('../lib/job');
var Queue = require('../lib/queue');

var chai = require('chai');
var assert = chai.assert;

describe('Job', function () {
  var queue = new Queue('test');
  var data;
  var job;

  var clearKeys = function (done) {
    queue.client.keys(queue.toKey('*'), function(err, keys) {
      if (keys.length) {
        queue.client.del(keys, done);
      } else {
        done();
      }
    });
  };

  before(clearKeys);
  after(clearKeys);

  beforeEach(function (done) {
    data = {foo: 'bar'};
    return queue.add(data, function (err, newJob) {
      job = newJob;
      done();
    });
  });

  describe('Constructor', function () {
    it('creates a job', function () {
      assert.ok(job, 'fails to return a job');
      assert.property(job, 'jobId', 'job has no jobId');
      assert.property(job, 'data', 'job has no data');
    });

    it('saves the job in redis', function (done) {
      Job.fromId(queue, job.jobId, function (err, storedJob) {
        assert.ok(storedJob, 'fails to return a job');
        assert.property(storedJob, 'jobId', 'stored job has no jobId');
        assert.property(storedJob, 'data', 'stored job has no data');
        assert.deepEqual(storedJob.data, data, 'stored job data is wrong');
        done();
      });
    });
  });

  describe('remove', function () {
    it('removes the job from redis', function (done) {
      job.remove(function (err) {
        assert.isNull(err);
        queue.client.get(queue.toKey(job.jobId), function (err, results) {
          assert.isNull(err);
          assert.isNull(results);
          done();
        });
      });
    });
  });

  describe('moveToSet', function () {
    var markJobTest = function (status) {
      return function (done) {
        job.isInSet(status, function (err, isMember) {
          assert.isNull(err);
          assert.isFalse(isMember);
          job.moveToSet(status, function (err) {
            assert.isNull(err);
            job.isInSet(status, function (err, isMember) {
              assert.isNull(err);
              assert.isTrue(isMember);
              done();
            });
          });
        });
      };
    };

    it('marks the job as succeeded', markJobTest('succeeded'));
    it('marks the job as failed', markJobTest('failed'));
  });

  describe('Locking', function () {
    it('acquires a lock', function (done) {
      return job.acquireLock(function (err, acquired) {
        assert.isTrue(acquired);
        done();
      });
    });

    it('cannot acquire existing lock', function (done) {
      return job.acquireLock(function (err, acquired) {
        assert.isTrue(acquired);
        job.acquireLock(function (err, acquired) {
          assert.isFalse(acquired);
          done();
        });
      });
    });

    it('can renew a previously taken lock', function (done) {
      return job.acquireLock(function (err, acquired) {
        assert.isTrue(acquired);
        job.renewLock(function (err, renewed) {
          assert.isTrue(renewed);
          done();
        });
      });
    });

    it('can renew a lock without acquiring first', function (done) {
      return job.renewLock(function (err, renewed) {
        assert.isTrue(renewed);
        done();
      });
    });

    it('can release a lock', function (done) {
      return job.acquireLock(function (err, acquired) {
        assert.isTrue(acquired);
        job.releaseLock(function (err, released) {
          assert.isTrue(released);
          done();
        });
      });
    });

    it('cannot release a lock with a different token', function (done) {
      return job.acquireLock(function (err, acquired) {
        assert.isTrue(acquired);
        job.queue.token = 'something else';
        job.releaseLock(function (err, released) {
          assert.isFalse(released);
          done();
        });
      });
    });
  });

});