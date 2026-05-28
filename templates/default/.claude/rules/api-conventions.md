# API Conventions

<!-- Customize for your API style -->

## REST
- Plural nouns for resources: `/users`, `/posts`
- HTTP verbs correctly: GET (read), POST (create), PUT (replace), PATCH (update), DELETE
- 200 for success, 201 for created, 400 for bad input, 401 for unauth, 404 for not found, 500 for server error
- Always return JSON, even for errors

## Error responses
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No user with id 123"
  }
}
```

## Versioning
- Version in URL path: `/v1/users`
- Never break existing endpoints — add new ones instead

## Auth
- Bearer token in `Authorization` header
- Never log tokens or passwords
