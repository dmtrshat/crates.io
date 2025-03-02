import { action } from '@ember/object';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import { rawTimeout, task } from 'ember-concurrency';

export default class ApplicationRoute extends Route {
  @service progress;
  @service router;
  @service session;
  @service playground;
  @service sentry;

  async beforeModel() {
    this.router.on('routeDidChange', () => {
      this.sentry.configureScope(scope => {
        scope.setTag('routeName', this.router.currentRouteName);
      });
    });

    // trigger the task, but don't wait for the result here
    //
    // we don't need a `catch()` block here because network
    // errors are already dealt with inside of the task
    // and any other errors should end up on Sentry.
    //
    // eslint-disable-next-line ember-concurrency/no-perform-without-catch
    this.session.loadUserTask.perform();

    // trigger the preload task, but don't wait for the task to finish.
    this.preloadPlaygroundCratesTask.perform().catch(() => {
      // ignore all errors since we're only preloading here
    });

    // load ResizeObserver polyfill, only if required.
    if (!('ResizeObserver' in window)) {
      console.debug('Loading ResizeObserver polyfill…');
      let module = await import('@juggle/resize-observer');
      window.ResizeObserver = module.ResizeObserver;
    }
  }

  @action loading(transition) {
    this.progress.handle(transition);
    return true;
  }

  @task(function* () {
    yield rawTimeout(1000);
    yield this.playground.loadCratesTask.perform();
  })
  preloadPlaygroundCratesTask;
}
