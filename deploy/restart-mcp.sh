#!/bin/sh
# Restarts the MCP server after a deploy that changed it or the data it reads.
#
# Installed to /usr/local/sbin/readquran-restart-mcp and owned by root, with a
# sudoers rule for this one command and no arguments, like the feedback one.

set -e
systemctl restart readquran-mcp
echo "mcp service restarted"
