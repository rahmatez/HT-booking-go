package response

import (
	"encoding/json"
	"net/http"
)

type Meta struct {
	Page    int   `json:"page,omitempty"`
	PerPage int   `json:"per_page,omitempty"`
	Total   int64 `json:"total,omitempty"`
}

type Success struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Meta    *Meta       `json:"meta,omitempty"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
}

func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func OK(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, Success{Success: true, Data: data})
}

func OKWithMeta(w http.ResponseWriter, data interface{}, meta Meta) {
	JSON(w, http.StatusOK, Success{Success: true, Data: data, Meta: &meta})
}

func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, Success{Success: true, Data: data})
}

func Fail(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorResponse{
		Success: false,
		Error:   ErrorBody{Code: code, Message: message},
	})
}

func BadRequest(w http.ResponseWriter, message string) {
	Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
}

func Unauthorized(w http.ResponseWriter, message string) {
	Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", message)
}

func Forbidden(w http.ResponseWriter, message string) {
	Fail(w, http.StatusForbidden, "FORBIDDEN", message)
}

func NotFound(w http.ResponseWriter, message string) {
	Fail(w, http.StatusNotFound, "NOT_FOUND", message)
}

func Conflict(w http.ResponseWriter, code, message string) {
	Fail(w, http.StatusConflict, code, message)
}

func TooManyRequests(w http.ResponseWriter, message string) {
	Fail(w, http.StatusTooManyRequests, "RATE_LIMITED", message)
}

func Internal(w http.ResponseWriter, message string) {
	Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", message)
}
