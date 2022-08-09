swrkroute
=========

Pronounced Sauerkraut

Zero dependencies!

Possible uses
-------------

- Request rewriting
- Reverse Proxy
- Load balancer
- Service Worker
- Mock APIs
- Cache responses
- Automatically mock APIs from swagger docs.

TODO
----

- CORS middleware
- Better types / Generics

Questions
---------

* What should happen if a matcher specifies no properties to match against?
  - The matcher succeeds.
      This should require that leaf nodes of the config must match or else the matcher fails.
  - The matcher fails.
  - An error is thrown in configuration.

* Should a match only be considered if it matches down to a leaf?
  In a normal router that only considers the path a path must match exactly. The leaf routers must have a match for the route to be run.
  I think it makes sense for this router to work that way as well. This will give the user more control over when a request gets rewritten,
  because it is easy to specify when a request matches. If an intermediate step matches but no leaf nodes match then there is no way to break out of that match.