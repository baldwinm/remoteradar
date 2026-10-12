"""Exceptions the API turns into clean JSON error responses."""


class AppError(Exception):
    status_code = 500
    code = "internal_error"
    public_message = "Something went wrong. Please try again."

    def __init__(self, message: str | None = None):
        super().__init__(message or self.public_message)
        if message:
            self.public_message = message


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    public_message = "Not found."


class ServiceNotConfiguredError(AppError):
    """An API key the feature needs has not been set."""

    status_code = 503
    code = "service_unavailable"
    public_message = "This feature is temporarily unavailable."


class UpstreamError(AppError):
    """A third-party API failed, timed out, or returned something unusable.

    `detail` is for the server log only; clients get a generic message so upstream
    error bodies (which can echo request details) never reach the browser.
    """

    status_code = 502
    code = "upstream_unavailable"
    public_message = "A data provider is not responding right now. Please try again shortly."

    def __init__(self, service: str, detail: str, status: int | None = None):
        super().__init__()
        self.service = service
        self.detail = detail
        self.upstream_status = status

    def __str__(self) -> str:
        status = f" (HTTP {self.upstream_status})" if self.upstream_status else ""
        return f"{self.service}{status}: {self.detail}"
