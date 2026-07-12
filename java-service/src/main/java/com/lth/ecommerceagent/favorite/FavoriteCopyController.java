package com.lth.ecommerceagent.favorite;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/favorite-copies")
public class FavoriteCopyController {

    private final FavoriteCopyRepository repository;

    public FavoriteCopyController(FavoriteCopyRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    public ResponseEntity<FavoriteCopy> create(@RequestBody FavoriteCopyRequest request) {
        FavoriteCopy copy = new FavoriteCopy();
        copy.setLabel(request.label());
        copy.setContent(request.content());
        copy.setTags(request.tags());
        copy.setSourcePlanId(request.sourcePlanId());
        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(copy));
    }

    @GetMapping
    public List<FavoriteCopy> list() {
        return repository.findAll();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    public record FavoriteCopyRequest(String label, String content, String tags, Long sourcePlanId) {
    }
}
