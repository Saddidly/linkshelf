# Security policy

LinkShelf stores private bookmark data in the browser's IndexedDB for the current site origin. It has no account system or hosted storage endpoint. Use a trusted HTTPS origin when hosting it, and do not expose a development server to an untrusted network.

Import validation accepts only HTTP and HTTPS destinations and escapes imported text before rendering it. Export files contain the saved URLs and titles, so handle them like private browser data.

To report a security issue, contact the repository maintainers through the private vulnerability-reporting channel configured by the repository host. Avoid posting bookmark files, private URLs, or a working exploit in a public issue.
