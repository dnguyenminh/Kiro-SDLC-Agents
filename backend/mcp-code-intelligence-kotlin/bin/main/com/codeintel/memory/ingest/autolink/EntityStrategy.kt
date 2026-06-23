/** Entity overlap linking via Jaccard similarity. KSA-190. */
package com.codeintel.memory.ingest.autolink

import com.codeintel.memory.map.EntityRepository

class EntityStrategy(
    private val entityRepo: EntityRepository
) : LinkingStrategy {

    override val name = "entity"

    override fun isEnabled(config: AutoLinkConfig): Boolean =
        config.entity.enabled

    override fun findCandidates(entryId: Long, config: AutoLinkConfig): List<CandidateEdge> {
        val myEntities = entityRepo.getEntities(entryId.toInt())
        if (myEntities.isEmpty()) return emptyList()

        val myNames = myEntities.map { it.entityName }.toSet()
        val candidateMap = buildCandidateMap(entryId, myEntities)

        return candidateMap
            .mapNotNull { (otherId, sharedNames) ->
                computeJaccardEdge(otherId, myNames, sharedNames, config)
            }
            .sortedByDescending { it.score }
            .take(config.entity.maxEdges)
    }

    private fun buildCandidateMap(
        entryId: Long,
        myEntities: List<com.codeintel.memory.map.EntityRecord>
    ): Map<Long, MutableSet<String>> {
        val map = mutableMapOf<Long, MutableSet<String>>()
        for (entity in myEntities) {
            val otherIds = entityRepo.findByEntity(entity.entityName)
            for (otherId in otherIds) {
                if (otherId.toLong() == entryId) continue
                map.getOrPut(otherId.toLong()) { mutableSetOf() }
                    .add(entity.entityName)
            }
        }
        return map
    }

    private fun computeJaccardEdge(
        otherId: Long,
        myNames: Set<String>,
        sharedNames: Set<String>,
        config: AutoLinkConfig
    ): CandidateEdge? {
        val otherEntities = entityRepo.getEntities(otherId.toInt())
        val otherNames = otherEntities.map { it.entityName }.toSet()
        val union = myNames + otherNames
        if (union.isEmpty()) return null
        val jaccard = sharedNames.size.toDouble() / union.size
        if (jaccard < config.entity.minJaccard) return null
        return CandidateEdge(
            targetId = otherId,
            relation = AutoLinkRelations.SHARES_ENTITY,
            score = jaccard,
            metadata = mapOf("shared" to sharedNames.toList(), "jaccard" to jaccard)
        )
    }
}
