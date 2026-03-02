#!/usr/bin/env ruby
exec "ruby", "-run", "-e", "httpd", __dir__, "-p", "8080"
